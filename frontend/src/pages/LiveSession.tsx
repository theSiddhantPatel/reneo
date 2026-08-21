import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AgoraRTC, {
  type ICameraVideoTrack,
  type IMicrophoneAudioTrack,
  type IRemoteVideoTrack,
  type IRemoteAudioTrack,
  type IAgoraRTCRemoteUser,
} from "agora-rtc-sdk-ng";
import { useAuth } from "../contexts/AuthContext";
import { joinAgoraChannel, agoraClient } from "../lib/agora";
import { getAgoraToken } from "../lib/agoraApi";
import { endLiveSession, endLiveSessionBeacon } from "../lib/liveApi";
import { supabase } from "../lib/supabase";
import Navbar from "../components/Navbar";
import StockAdjuster from "../components/StockAdjuster";
import type { LiveSessionData } from "../types/liveSession";
import type { Product } from "../types/product";

type Message = {
  id: string;
  live_id: string;
  user_id: string;
  message: string;
  created_at: string;
  profiles?: { name: string | null } | { name: string | null }[] | null;
};

type CartItem = {
  id: string;
  product_id: string;
  quantity: number;
  products: Product | Product[] | null;
};

type SellerProfile = {
  id: string;
  name: string | null;
};

type FloatingReaction = {
  id: string;
  emoji: string;
  xOffset: number;
  duration: number;
};

function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function LiveSession() {
  const { liveId } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [session, setSession] = useState<LiveSessionData | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [messageText, setMessageText] = useState("");
  const [viewerCount, setViewerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  // Live Floating Emoji Reactions State
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [isReactionsFolded, setIsReactionsFolded] = useState(false);

  // Product Switcher State (Multi-Product Showcase - Part B)
  const [isProductSwitcherOpen, setIsProductSwitcherOpen] = useState(false);
  const [sellerInventory, setSellerInventory] = useState<Product[]>([]);
  const [isSwitchingProduct, setIsSwitchingProduct] = useState(false);

  // Product modal view state (inspect product without leaving stream)
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);

  // Mobile active tab: 'chat' | 'product' | 'cart'
  const [activeMobileTab, setActiveMobileTab] = useState<"chat" | "product" | "cart">("chat");

  const [localVideoTrack, setLocalVideoTrack] =
    useState<ICameraVideoTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] =
    useState<IMicrophoneAudioTrack | null>(null);
  const [remoteVideoTrack, setRemoteVideoTrack] =
    useState<IRemoteVideoTrack | null>(null);
  const [remoteAudioTrack, setRemoteAudioTrack] =
    useState<IRemoteAudioTrack | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isEndingLive, setIsEndingLive] = useState(false);

  // Customer Player Controls State
  const [isCustomerVideoOff, setIsCustomerVideoOff] = useState(false);
  const [isCustomerAudioMuted, setIsCustomerAudioMuted] = useState(false);
  const [volume, setVolume] = useState(100);

  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const microphoneTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const cameraTrackRef = useRef<ICameraVideoTrack | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const liveChannelRef = useRef<any>(null);

  const totalCartCount = useMemo(
    () => cartItems.reduce((acc, item) => acc + item.quantity, 0),
    [cartItems],
  );

  const cartTotal = useMemo(
    () =>
      cartItems.reduce(
        (total, item) =>
          total + (getJoinedProduct(item)?.price ?? 0) * item.quantity,
        0,
      ),
    [cartItems],
  );

  function generateAgoraUid(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i += 1) {
      hash = (hash * 31 + userId.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) || 1;
  }

  function getJoinedProduct(item: CartItem): Product | null {
    if (!item.products) return null;
    return Array.isArray(item.products) ? item.products[0] : item.products;
  }

  function getMessageAuthor(message: Message): string {
    const author = Array.isArray(message.profiles)
      ? message.profiles[0]
      : message.profiles;
    return author?.name ?? "Guest";
  }

  const cleanupAgora = async () => {
    try {
      if (
        profile?.role === "seller" &&
        agoraClient.connectionState === "CONNECTED" &&
        (microphoneTrackRef.current || cameraTrackRef.current)
      ) {
        await agoraClient.unpublish();
      }

      microphoneTrackRef.current?.close();
      cameraTrackRef.current?.close();
      microphoneTrackRef.current = null;
      cameraTrackRef.current = null;

      if (
        agoraClient.connectionState === "CONNECTED" ||
        agoraClient.connectionState === "CONNECTING"
      ) {
        await agoraClient.leave();
      }

      setLocalAudioTrack(null);
      setLocalVideoTrack(null);
      setRemoteVideoTrack(null);
      setRemoteAudioTrack(null);
    } catch (err) {
      console.error("Agora cleanup failed:", err);
    }
  };

  async function fetchCart() {
    if (!user) return;

    try {
      // 1. Fetch user's cart rows
      const { data: rawItems, error: cartError } = await supabase
        .from("cart_items")
        .select("id, product_id, quantity")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (cartError) {
        console.error("Cart fetch error:", cartError);
        return;
      }

      if (!rawItems || rawItems.length === 0) {
        setCartItems([]);
        return;
      }

      // 2. Fetch products for these cart items
      const productIds = rawItems.map((i) => i.product_id);
      const { data: prods } = await supabase
        .from("products")
        .select("*")
        .in("id", productIds);

      const prodMap = new Map((prods ?? []).map((p) => [p.id, p]));

      const enriched: CartItem[] = rawItems.map((item) => ({
        id: item.id,
        product_id: item.product_id,
        quantity: item.quantity,
        products: prodMap.get(item.product_id) ?? null,
      }));

      setCartItems(enriched);
    } catch (err) {
      console.error("Cart load failed:", err);
    }
  }

  async function addToCart() {
    if (!user || !product) {
      setInfo("Please log in to add items to cart.");
      return;
    }

    if (product.stock < 1) {
      setInfo("This product is out of stock.");
      return;
    }

    try {
      const existing = cartItems.find((item) => item.product_id === product.id);

      if (existing) {
        if (existing.quantity >= product.stock) {
          setInfo(
            `Cannot add more. You have reached the maximum available stock (${product.stock}).`,
          );
          setTimeout(() => setInfo(""), 4000);
          return;
        }

        await updateCartQuantity(existing.id, existing.quantity + 1);
        setInfo(`Updated quantity for "${product.name}" in cart!`);
        setTimeout(() => setInfo(""), 4000);
        return;
      }

      const { data: inserted, error: insertError } = await supabase
        .from("cart_items")
        .insert({
          user_id: user.id,
          product_id: product.id,
          quantity: 1,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Add to cart error:", insertError);
        setInfo(`Could not add to cart: ${insertError.message}`);
        return;
      }

      // Optimistically add to state
      setCartItems((prev) => [
        ...prev,
        {
          id: inserted?.id ?? crypto.randomUUID(),
          product_id: product.id,
          quantity: 1,
          products: product,
        },
      ]);

      setInfo(`Added "${product.name}" to cart!`);
      setTimeout(() => setInfo(""), 4000);
      fetchCart();
    } catch (err) {
      console.error("Add to cart exception:", err);
      setInfo("Failed to add to cart.");
    }
  }

  async function updateCartQuantity(itemId: string, quantity: number) {
    if (quantity < 1) {
      await removeCartItem(itemId);
      return;
    }

    const currentItem = cartItems.find((i) => i.id === itemId);
    const itemProd = currentItem ? getJoinedProduct(currentItem) : null;

    if (itemProd && quantity > itemProd.stock) {
      setInfo(`Cannot add more. Only ${itemProd.stock} units available in stock.`);
      setTimeout(() => setInfo(""), 4000);
      return;
    }

    // Optimistically update
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, quantity } : item,
      ),
    );

    const { error: updateError } = await supabase
      .from("cart_items")
      .update({ quantity })
      .eq("id", itemId);

    if (updateError) {
      console.error("Update cart error:", updateError);
      setInfo(`Cart error: ${updateError.message}`);
      fetchCart();
    }
  }

  async function removeCartItem(itemId: string) {
    // Optimistically remove
    setCartItems((prev) => prev.filter((item) => item.id !== itemId));

    const { error: deleteError } = await supabase
      .from("cart_items")
      .delete()
      .eq("id", itemId);

    if (deleteError) {
      console.error("Delete cart error:", deleteError);
      setInfo(`Could not remove: ${deleteError.message}`);
      fetchCart();
    }
  }

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!liveId || !user || !messageText.trim()) return;

    const text = messageText.trim();
    const tempId = crypto.randomUUID();
    const nowIso = new Date().toISOString();
    const senderName = profile?.name ?? "User";

    setMessageText("");

    const newMsgObj: Message = {
      id: tempId,
      live_id: liveId,
      user_id: user.id,
      message: text,
      created_at: nowIso,
      profiles: { name: senderName },
    };

    // 1. Optimistically display message immediately in sender's UI
    setMessages((prev) => {
      if (prev.some((m) => m.id === tempId)) return prev;
      return [...prev, newMsgObj];
    });

    // 2. Broadcast via Supabase Realtime channel for instant peer delivery
    if (liveChannelRef.current) {
      liveChannelRef.current.send({
        type: "broadcast",
        event: "chat_message",
        payload: newMsgObj,
      });
    }

    // 3. Persist to Postgres database with the matching UUID
    const { data: insertedMessage, error: chatError } = await supabase
      .from("live_messages")
      .insert({
        id: tempId,
        live_id: liveId,
        user_id: user.id,
        message: text,
      })
      .select("id, live_id, user_id, message, created_at")
      .single();

    if (chatError) {
      console.error("Live message insert error:", chatError);
      setInfo(`Chat notice: ${chatError.message}`);
    } else if (insertedMessage) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? { ...insertedMessage, profiles: { name: senderName } }
            : m,
        ),
      );
    }
  }

  async function handleEndLive() {
    if (!liveId || profile?.role !== "seller") return;

    const confirmEnd = window.confirm("Are you sure you want to end this live broadcast?");
    if (!confirmEnd) return;

    setIsEndingLive(true);
    try {
      await cleanupAgora();
      const endedLive = await endLiveSession(liveId);
      setSession(endedLive);
      setInfo("Live broadcast has ended.");

      // Broadcast ended state to all viewers
      if (liveChannelRef.current) {
        liveChannelRef.current.send({
          type: "broadcast",
          event: "stream_ended",
          payload: { live_id: liveId },
        });
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to end live session.",
      );
    } finally {
      setIsEndingLive(false);
    }
  }

  async function toggleMute() {
    if (!localAudioTrack) {
      setInfo("Microphone is not available.");
      return;
    }

    const nextMuted = !isMuted;
    await localAudioTrack.setEnabled(!nextMuted);
    setIsMuted(nextMuted);
  }

  async function toggleCamera() {
    if (!localVideoTrack) {
      setInfo("Camera is not available.");
      return;
    }

    const nextCameraOff = !isCameraOff;
    await localVideoTrack.setEnabled(!nextCameraOff);
    setIsCameraOff(nextCameraOff);
  }

  async function switchCamera() {
    if (!localVideoTrack) {
      setInfo("Camera is not available.");
      return;
    }

    const cameras = await AgoraRTC.getCameras();
    if (cameras.length < 2) {
      setInfo("No second camera found on this device.");
      setTimeout(() => setInfo(""), 3000);
      return;
    }

    const currentDeviceId = localVideoTrack
      .getMediaStreamTrack()
      .getSettings().deviceId;
    const nextCamera =
      cameras.find((camera) => camera.deviceId !== currentDeviceId) ??
      cameras[0];

    await localVideoTrack.setDevice(nextCamera.deviceId);
    setInfo(`Switched camera to ${nextCamera.label || "secondary camera"}`);
    setTimeout(() => setInfo(""), 3000);
  }

  async function enterFullscreen() {
    if (!videoContainerRef.current) return;

    if (!document.fullscreenElement) {
      await videoContainerRef.current.requestFullscreen().catch(() => { });
    } else {
      await document.exitFullscreen().catch(() => { });
    }
  }

  function toggleCustomerVideo() {
    const nextVideoOff = !isCustomerVideoOff;
    setIsCustomerVideoOff(nextVideoOff);
    if (nextVideoOff) {
      remoteVideoTrack?.stop();
      setInfo("Stream video paused/hidden.");
    } else {
      if (remoteVideoTrack && videoContainerRef.current) {
        remoteVideoTrack.play(videoContainerRef.current);
      }
      setInfo("Stream video resumed.");
    }
    setTimeout(() => setInfo(""), 2500);
  }

  function toggleCustomerMute() {
    const nextMuted = !isCustomerAudioMuted;
    setIsCustomerAudioMuted(nextMuted);
    if (remoteAudioTrack) {
      remoteAudioTrack.setVolume(nextMuted ? 0 : volume);
    }
    setInfo(nextMuted ? "Stream audio muted." : `Stream audio unmuted (${volume}%).`);
    setTimeout(() => setInfo(""), 2500);
  }

  function handleVolumeChange(newVolume: number) {
    const clamped = Math.max(0, Math.min(100, newVolume));
    setVolume(clamped);
    if (clamped === 0) {
      setIsCustomerAudioMuted(true);
    } else if (isCustomerAudioMuted) {
      setIsCustomerAudioMuted(false);
    }
    if (remoteAudioTrack) {
      remoteAudioTrack.setVolume(clamped);
    }
  }

  function volumeDown() {
    handleVolumeChange(volume - 10);
  }

  function volumeUp() {
    handleVolumeChange(volume + 10);
  }

  async function handleCustomerLeave() {
    const confirmLeave = window.confirm("Are you sure you want to leave this live stream?");
    if (!confirmLeave) return;

    await cleanupAgora();
    navigate("/customer");
  }

  function triggerReaction(emoji: string) {
    const reactionId = crypto.randomUUID();
    // Randomize horizontal spawn position (66% to 90%)
    const xOffset = Math.floor(Math.random() * 24) + 68;
    const duration = parseFloat((Math.random() * 0.6 + 2.2).toFixed(2));

    const newReaction: FloatingReaction = {
      id: reactionId,
      emoji,
      xOffset,
      duration,
    };

    // 1. Spatially spawn reaction on local screen
    setReactions((prev) => [...prev.slice(-25), newReaction]);

    // 2. Broadcast live to all viewers and host
    if (liveChannelRef.current) {
      liveChannelRef.current.send({
        type: "broadcast",
        event: "emoji_reaction",
        payload: newReaction,
      });
    }

    // 3. Remove reaction from memory once animation completes
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== reactionId));
    }, 3200);
  }

  // Switch Featured Product Live (Multi-Product Showcase - Part B)
  async function handleSwitchFeaturedProduct(newProduct: Product) {
    if (!liveId || newProduct.id === product?.id) return;

    setIsSwitchingProduct(true);
    try {
      // 1. Optimistically update product state locally
      setProduct(newProduct);
      setIsProductSwitcherOpen(false);

      // 2. Broadcast switch event to all connected customers in sub-30ms
      if (liveChannelRef.current) {
        liveChannelRef.current.send({
          type: "broadcast",
          event: "featured_product_switched",
          payload: newProduct,
        });
      }

      // 3. Persist new product_id in Postgres live_sessions table
      const { error: updateErr } = await supabase
        .from("live_sessions")
        .update({ product_id: newProduct.id })
        .eq("live_id", liveId);

      if (updateErr) {
        console.error("Failed to update featured product in database:", updateErr);
      }

      setInfo(`Pinned "${newProduct.name}" as the active featured product!`);
      setTimeout(() => setInfo(""), 4000);
    } catch (err) {
      console.error("Failed to switch featured product:", err);
      setInfo("Failed to switch product.");
    } finally {
      setIsSwitchingProduct(false);
    }
  }

  // In-Stream Stock Adjustment for Host
  const handleUpdateStock = async (productId: string, newStock: number) => {
    if (product && product.id === productId) {
      setProduct((prev) => (prev ? { ...prev, stock: newStock } : null));
    }
    setSellerInventory((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, stock: newStock } : p))
    );

    if (liveChannelRef.current) {
      liveChannelRef.current.send({
        type: "broadcast",
        event: "stock_updated",
        payload: { productId, stock: newStock },
      });
    }

    const { error: stockErr } = await supabase
      .from("products")
      .update({ stock: newStock })
      .eq("id", productId);

    if (stockErr) {
      console.error("Failed to update stock live:", stockErr);
      setInfo(`Failed to update stock: ${stockErr.message}`);
      return false;
    }
  };

  // Fetch Live Session Details, Product, Seller, and Initial Chat
  useEffect(() => {
    async function fetchLiveSession() {
      if (!liveId) {
        setError("Live session ID is missing.");
        setLoading(false);
        return;
      }

      // 1. Fetch Session Record with joined host profile and product
      const { data: sessionData, error: sessionErr } = await supabase
        .from("live_sessions")
        .select(`
          *,
          profiles:host_id (id, name, role),
          products:product_id (*)
        `)
        .eq("live_id", liveId)
        .single();

      if (sessionErr || !sessionData) {
        console.error("Session fetch error:", sessionErr);
        setError("Live session not found.");
        setLoading(false);
        return;
      }

      setSession(sessionData);

      // Prepopulate joined host profile and product if returned
      const joinedProfile = Array.isArray((sessionData as any).profiles)
        ? (sessionData as any).profiles[0]
        : (sessionData as any).profiles;

      const joinedProduct = Array.isArray((sessionData as any).products)
        ? (sessionData as any).products[0]
        : (sessionData as any).products;

      if (joinedProfile?.name) {
        setSeller(joinedProfile);
      } else if (sessionData.host_id === user?.id && profile?.name) {
        setSeller({ id: sessionData.host_id, name: profile.name });
      }

      if (joinedProduct) {
        setProduct(joinedProduct);
      }

      // 2. Fetch Host Profile, Product, Messages, and Seller's Product Inventory in parallel
      try {
        const [productRes, sellerRes, rawChatRes, inventoryRes] = await Promise.all([
          !joinedProduct
            ? supabase
              .from("products")
              .select("*")
              .in("id", [sessionData.product_id])
            : Promise.resolve({ data: [joinedProduct] }),
          !joinedProfile?.name
            ? supabase
              .from("profiles")
              .select("id, name")
              .in("id", [sessionData.host_id])
            : Promise.resolve({ data: [joinedProfile] }),
          supabase
            .from("live_messages")
            .select("id, live_id, user_id, message, created_at")
            .eq("live_id", liveId)
            .order("created_at", { ascending: true }),
          supabase
            .from("products")
            .select("*")
            .eq("seller_id", sessionData.host_id)
            .eq("status", "active")
            .order("created_at", { ascending: false }),
        ]);

        if (productRes.data && productRes.data.length > 0) {
          setProduct(productRes.data[0]);
        }

        if (inventoryRes.data) {
          setSellerInventory(inventoryRes.data);
        }

        if (sellerRes.data && sellerRes.data.length > 0 && sellerRes.data[0]?.name) {
          setSeller(sellerRes.data[0]);
        } else if (productRes.data && productRes.data[0]?.seller_id) {
          const { data: fallbackSellerList } = await supabase
            .from("profiles")
            .select("id, name")
            .in("id", [productRes.data[0].seller_id]);
          if (fallbackSellerList && fallbackSellerList[0]?.name) {
            setSeller(fallbackSellerList[0]);
          }
        }

        if (rawChatRes.data && rawChatRes.data.length > 0) {
          const userIds = Array.from(new Set(rawChatRes.data.map((m) => m.user_id)));
          const { data: authorProfiles } = await supabase
            .from("profiles")
            .select("id, name")
            .in("id", userIds);

          const authorMap = new Map((authorProfiles ?? []).map((p) => [p.id, p.name]));

          const enrichedMessages: Message[] = rawChatRes.data.map((m) => ({
            ...m,
            profiles: { name: authorMap.get(m.user_id) ?? "User" },
          }));

          setMessages(enrichedMessages);
        }
      } catch (e) {
        console.error("Error loading session components:", e);
      } finally {
        setLoading(false);
      }
    }

    fetchLiveSession();
  }, [liveId]);

  // Load customer's cart
  useEffect(() => {
    fetchCart();
  }, [user?.id]);

  // Auto-scroll chat box when new messages arrive
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Agora Streaming Lifecycle
  useEffect(() => {
    if (!liveId || session?.status !== "live" || !user || !profile?.role) {
      return;
    }

    let cancelled = false;

    async function startAgora() {
      try {
        const uid = generateAgoraUid(user!.id);
        const agoraData = await getAgoraToken(liveId!, uid);

        if (cancelled) return;

        if (profile!.role === "seller") {
          await agoraClient.setClientRole("host");
          await joinAgoraChannel(
            agoraData.appId,
            agoraData.channelName,
            agoraData.token,
            agoraData.uid,
          );

          const [microphoneTrack, cameraTrack] =
            await AgoraRTC.createMicrophoneAndCameraTracks();

          if (cancelled) {
            microphoneTrack.close();
            cameraTrack.close();
            return;
          }

          microphoneTrackRef.current = microphoneTrack;
          cameraTrackRef.current = cameraTrack;
          setLocalAudioTrack(microphoneTrack);
          setLocalVideoTrack(cameraTrack);
          await agoraClient.publish([microphoneTrack, cameraTrack]);
        }

        if (profile!.role === "customer") {
          await agoraClient.setClientRole("audience");
          await joinAgoraChannel(
            agoraData.appId,
            agoraData.channelName,
            agoraData.token,
            agoraData.uid,
          );
        }
      } catch (err) {
        if (cancelled) return;

        const message =
          err instanceof Error ? err.message : "Could not join stream.";

        await cleanupAgora();

        if (
          message.toLowerCase().includes("permission") ||
          message.toLowerCase().includes("notallowed")
        ) {
          setError("Camera or microphone permission was denied. Please allow device access in your browser.");
        } else if (
          message.toLowerCase().includes("notfound") ||
          message.toLowerCase().includes("device")
        ) {
          setError("Camera or microphone was not found on this device.");
        } else if (message.toLowerCase().includes("ended")) {
          setError("This live broadcast has already ended.");
        } else {
          setError("Could not connect to the live stream. Please check your network connection.");
        }
      }
    }

    startAgora();

    return () => {
      cancelled = true;
      cleanupAgora();
    };
  }, [liveId, session?.status, profile?.role, user?.id]);

  // Customer Agora Subscriptions
  useEffect(() => {
    if (profile?.role !== "customer") return;

    const handleUserPublished = async (
      remoteUser: IAgoraRTCRemoteUser,
      mediaType: "audio" | "video",
    ) => {
      try {
        await agoraClient.subscribe(remoteUser, mediaType);

        if (mediaType === "video") {
          setRemoteVideoTrack(remoteUser.videoTrack ?? null);
        }

        if (mediaType === "audio") {
          const audioTrack = remoteUser.audioTrack ?? null;
          setRemoteAudioTrack(audioTrack);
          if (audioTrack) {
            audioTrack.setVolume(isCustomerAudioMuted ? 0 : volume);
            audioTrack.play();
          }
        }
      } catch {
        setInfo("The stream had a temporary interruption. Reconnecting...");
      }
    };

    const handleUserUnpublished = (
      _remoteUser: IAgoraRTCRemoteUser,
      mediaType: "audio" | "video",
    ) => {
      if (mediaType === "video") {
        setRemoteVideoTrack(null);
      }
      if (mediaType === "audio") {
        setRemoteAudioTrack(null);
      }
    };

    const handleUserLeft = (
      _remoteUser: IAgoraRTCRemoteUser,
      reason: string,
    ) => {
      console.log("Seller/host left the stream:", reason);
      setRemoteVideoTrack(null);
      setRemoteAudioTrack(null);
      setSession((prev) => (prev ? { ...prev, status: "ended" } : prev));
      setInfo("The seller has ended or left the live stream.");
    };

    agoraClient.on("user-published", handleUserPublished);
    agoraClient.on("user-unpublished", handleUserUnpublished);
    agoraClient.on("user-left", handleUserLeft);

    return () => {
      agoraClient.off("user-published", handleUserPublished);
      agoraClient.off("user-unpublished", handleUserUnpublished);
      agoraClient.off("user-left", handleUserLeft);
    };
  }, [profile?.role, isCustomerAudioMuted, volume]);

  // Seller Unload / Close Browser Auto-End Live Session
  useEffect(() => {
    if (profile?.role !== "seller" || !liveId || session?.status !== "live") return;

    const handleSellerUnload = () => {
      if (liveChannelRef.current) {
        liveChannelRef.current.send({
          type: "broadcast",
          event: "stream_ended",
          payload: { live_id: liveId },
        });
      }
      endLiveSessionBeacon(liveId);
    };

    window.addEventListener("beforeunload", handleSellerUnload);
    window.addEventListener("pagehide", handleSellerUnload);

    return () => {
      window.removeEventListener("beforeunload", handleSellerUnload);
      window.removeEventListener("pagehide", handleSellerUnload);
    };
  }, [profile?.role, liveId, session?.status]);

  // Play Video Track in Container
  useEffect(() => {
    const videoTrack =
      profile?.role === "seller" ? localVideoTrack : remoteVideoTrack;

    if (!videoTrack || !videoContainerRef.current || isCameraOff || isCustomerVideoOff) return;

    videoTrack.play(videoContainerRef.current);

    return () => {
      videoTrack.stop();
    };
  }, [profile?.role, localVideoTrack, remoteVideoTrack, isCameraOff, isCustomerVideoOff]);

  // Realtime Supabase Channel: Broadcast (Instant Chat), Postgres Changes, and Presence
  useEffect(() => {
    if (!liveId) return;

    const isDuplicateMessage = (existingList: Message[], newMsg: Message) => {
      return existingList.some(
        (m) =>
          m.id === newMsg.id ||
          (m.user_id === newMsg.user_id &&
            m.message === newMsg.message &&
            Math.abs(new Date(m.created_at).getTime() - new Date(newMsg.created_at).getTime()) < 3000),
      );
    };

    const liveChannel = supabase.channel(`live-room-${liveId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: user?.id ?? crypto.randomUUID() },
      },
    });

    liveChannelRef.current = liveChannel;

    // 1. Listen to instant broadcast chat messages & reactions
    liveChannel
      .on("broadcast", { event: "chat_message" }, (payload) => {
        const incomingMsg = payload.payload as Message;
        setMessages((current) => {
          if (isDuplicateMessage(current, incomingMsg)) {
            return current;
          }
          return [...current, incomingMsg];
        });
      })
      .on("broadcast", { event: "emoji_reaction" }, (payload) => {
        const incomingReaction = payload.payload as FloatingReaction;
        if (incomingReaction?.id && incomingReaction?.emoji) {
          setReactions((prev) => [...prev.slice(-25), incomingReaction]);

          setTimeout(() => {
            setReactions((prev) => prev.filter((r) => r.id !== incomingReaction.id));
          }, 3200);
        }
      })
      .on("broadcast", { event: "featured_product_switched" }, (payload) => {
        const newProduct = payload.payload as Product;
        if (newProduct?.id) {
          setProduct(newProduct);
          setInfo(`Featured product updated: "${newProduct.name}"!`);
          setTimeout(() => setInfo(""), 4500);
        }
      })
      .on("broadcast", { event: "stock_updated" }, (payload) => {
        const { productId, stock: newStock } = payload.payload as {
          productId: string;
          stock: number;
        };
        if (productId !== undefined && newStock !== undefined) {
          setProduct((prev) =>
            prev && prev.id === productId ? { ...prev, stock: newStock } : prev
          );
          setSellerInventory((prev) =>
            prev.map((p) => (p.id === productId ? { ...p, stock: newStock } : p))
          );
        }
      })
      .on("broadcast", { event: "stream_ended" }, () => {
        setSession((prev) => (prev ? { ...prev, status: "ended" } : prev));
        setInfo("The live broadcast has ended.");
      })
      // 2. Fallback postgres_changes for database sync
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "live_messages",
          filter: `live_id=eq.${liveId}`,
        },
        async (payload) => {
          const newMessage = payload.new as Message;
          const { data } = await supabase
            .from("profiles")
            .select("name")
            .eq("id", newMessage.user_id)
            .single();

          setMessages((current) => {
            if (isDuplicateMessage(current, newMessage)) {
              return current;
            }
            return [
              ...current,
              { ...newMessage, profiles: data ?? null },
            ];
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "live_sessions",
          filter: `live_id=eq.${liveId}`,
        },
        (payload) => {
          setSession(payload.new as LiveSessionData);
        },
      )
      // 3. Presence tracking (Only count customer viewers, excluding host)
      .on("presence", { event: "sync" }, () => {
        const presenceState = liveChannel.presenceState();
        let customerViewerCount = 0;

        Object.entries(presenceState).forEach(([key, presences]: [string, any]) => {
          const userPresenceList = Array.isArray(presences) ? presences : [presences];
          const p = userPresenceList[0];

          // Check if this presence is the host/seller
          const isHost =
            (session?.host_id && (key === session.host_id || p?.user_id === session.host_id)) ||
            p?.role === "seller";

          if (!isHost) {
            customerViewerCount += 1;
          }
        });

        setViewerCount(customerViewerCount);
      })
      .on("presence", { event: "leave" }, ({ leftPresences }: { leftPresences: any[] }) => {
        if (session?.host_id && leftPresences.some((p: any) => p.user_id === session.host_id)) {
          setSession((prev) => (prev ? { ...prev, status: "ended" } : prev));
          setInfo("The seller has disconnected from the stream.");
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await liveChannel.track({
            user_id: user?.id,
            role: profile?.role,
            joined_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(liveChannel);
      liveChannelRef.current = null;
    };
  }, [liveId, profile?.role, user?.id, session?.host_id]);

  useEffect(() => {
    if (session?.status === "ended") {
      cleanupAgora();
    }
  }, [session?.status]);

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner"></div>
        <p>Connecting to Reneo Live session...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-layout">
        <Navbar />
        <main className="main-content">
          <div className="card" style={{ textAlign: "center", padding: 36, maxWidth: 500, margin: "40px auto" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <h2>Live Session Notice</h2>
            <p className="text-muted" style={{ marginBottom: 24 }}>{error}</p>
            <Link
              to={profile?.role === "seller" ? "/seller" : "/customer"}
              className="btn-primary"
            >
              Return to Dashboard
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="app-layout">
        <Navbar />
        <main className="main-content">
          <div className="card empty-state">
            <p>Live session was not found.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Navbar />

      <main className="live-stream-container">
        {/* Stream Banner Info */}
        <div className="live-header-bar">
          <div className="live-header-info">
            <div className="live-badge-row">
              <span className={`status-pill ${session.status === "live" ? "status-live" : "status-ended"}`}>
                {session.status === "live" ? "🔴 LIVE" : "ENDED"}
              </span>
              <span className="viewers-count">
                👁️ {viewerCount} {viewerCount === 1 ? "viewer" : "viewers"}
              </span>
            </div>
            <h1 className="live-title">{product?.name ?? "Live Showcase"}</h1>
            {profile?.role === "customer" && (
              <p className="live-host">
                Hosted by <strong>{seller?.name || "Seller"}</strong>
              </p>
            )}
          </div>

          <div className="live-header-actions">
            {profile?.role === "customer" && (
              <button
                onClick={() => setActiveMobileTab("cart")}
                className="cart-indicator-btn"
                title="View cart"
              >
                🛒 Cart <span className="cart-count-pill">{totalCartCount}</span>
              </button>
            )}
          </div>
        </div>

        {info && <div className="toast-notification">{info}</div>}

        {session.status === "ended" && profile?.role === "customer" && (
          <div className="alert alert-warning" style={{ margin: "8px 0 16px" }}>
            This live stream has ended. You can still inspect the featured product and manage your cart.
          </div>
        )}

        {session.status === "ended" && profile?.role === "seller" && (
          <div
            className="alert alert-warning"
            style={{
              margin: "8px 0 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <span>Your live broadcast has ended. Thank you for streaming!</span>
            <Link to="/seller" className="btn-secondary btn-sm">
              Return to Dashboard
            </Link>
          </div>
        )}

        {/* Main Live Commerce Grid */}
        <div className="live-main-grid">
          {/* Left Column: Video Player & Host Controls */}
          <div className="video-player-col">
            <div className="video-player-frame">
              <div
                ref={videoContainerRef}
                className="agora-video-viewport"
              />

              {session.status === "live" && !localVideoTrack && !remoteVideoTrack && !isCustomerVideoOff && (
                <div className="video-waiting-overlay">
                  <div className="spinner"></div>
                  <p>
                    {profile?.role === "seller"
                      ? "Initializing host camera & microphone..."
                      : "Connecting to host video stream..."}
                  </p>
                </div>
              )}

              {profile?.role === "customer" && isCustomerVideoOff && (
                <div className="video-waiting-overlay">
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🙈</div>
                  <p>Video stream hidden</p>
                  <button
                    onClick={toggleCustomerVideo}
                    className="btn-secondary btn-sm"
                    style={{ marginTop: 10 }}
                  >
                    Resume Video
                  </button>
                </div>
              )}

              {session.status === "ended" && (
                <div className="video-ended-overlay">
                  <h3>Stream Ended</h3>
                  <p>
                    {profile?.role === "seller"
                      ? "Thank you for streaming!"
                      : "Thank you for watching!"}
                  </p>
                  {profile?.role === "seller" && (
                    <Link
                      to="/seller"
                      className="btn-primary btn-sm"
                      style={{ marginTop: 12 }}
                    >
                      Go to Dashboard
                    </Link>
                  )}
                </div>
              )}

              {/* Floating Live Emoji Reactions */}
              <div className="floating-reactions-container" aria-hidden="true">
                {reactions.map((r) => (
                  <span
                    key={r.id}
                    className="floating-emoji"
                    style={{
                      left: `${r.xOffset}%`,
                      animationDuration: `${r.duration}s`,
                    }}
                  >
                    {r.emoji}
                  </span>
                ))}
              </div>

              {/* Foldable Quick Reactions Bar (Customer Only) */}
              {profile?.role === "customer" && session.status === "live" && (
                <div className="live-reactions-wrapper">
                  {isReactionsFolded ? (
                    <button
                      type="button"
                      onClick={() => setIsReactionsFolded(false)}
                      className="btn-reactions-fold-toggle"
                      title="Expand live emoji reactions"
                      aria-label="Expand emoji reactions"
                    >
                      <span className="reaction-fold-icon">❤️</span>
                      <span>React</span>
                    </button>
                  ) : (
                    <div className="live-reactions-bar">
                      <div className="reactions-emoji-list">
                        <button
                          type="button"
                          onClick={() => triggerReaction("❤️")}
                          className="btn-reaction"
                          title="Send Heart (Love)"
                          aria-label="Send Heart reaction"
                        >
                          ❤️
                        </button>
                        <button
                          type="button"
                          onClick={() => triggerReaction("🔥")}
                          className="btn-reaction"
                          title="Send Fire (Hyped)"
                          aria-label="Send Fire reaction"
                        >
                          🔥
                        </button>
                        <button
                          type="button"
                          onClick={() => triggerReaction("👏")}
                          className="btn-reaction"
                          title="Send Clap (Applause)"
                          aria-label="Send Clap reaction"
                        >
                          👏
                        </button>
                        <button
                          type="button"
                          onClick={() => triggerReaction("🚀")}
                          className="btn-reaction"
                          title="Send Rocket (Awesome)"
                          aria-label="Send Rocket reaction"
                        >
                          🚀
                        </button>
                        <button
                          type="button"
                          onClick={() => triggerReaction("🛍️")}
                          className="btn-reaction"
                          title="Send Shopping (Buy)"
                          aria-label="Send Shopping reaction"
                        >
                          🛍️
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsReactionsFolded(true)}
                        className="btn-reaction-fold-close"
                        title="Fold emoji reactions bar"
                        aria-label="Fold reactions"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Seller Live Broadcast Controls */}
            {profile?.role === "seller" && session.status === "live" && (
              <div className="host-controls-panel">
                <button
                  onClick={toggleMute}
                  className={`btn-control ${isMuted ? "btn-control-danger" : ""}`}
                >
                  {isMuted ? "🔇 Unmute Mic" : "🎙️ Mute Mic"}
                </button>
                <button
                  onClick={toggleCamera}
                  className={`btn-control ${isCameraOff ? "btn-control-danger" : ""}`}
                >
                  {isCameraOff ? "📷 Turn Camera On" : "🚫 Turn Camera Off"}
                </button>
                <button onClick={switchCamera} className="btn-control">
                  🔄 Switch Camera
                </button>
                <button onClick={enterFullscreen} className="btn-control">
                  ⛶ Fullscreen
                </button>
                <button
                  onClick={handleEndLive}
                  disabled={isEndingLive}
                  className="btn-control btn-control-end"
                >
                  {isEndingLive ? "Ending..." : "🛑 End Broadcast"}
                </button>
              </div>
            )}

            {/* Customer Live Stream Controls */}
            {profile?.role === "customer" && session.status === "live" && (
              <div className="customer-controls-panel">
                <div className="controls-group">
                  <button
                    onClick={toggleCustomerMute}
                    className={`btn-control ${isCustomerAudioMuted ? "btn-control-danger" : ""}`}
                    title={isCustomerAudioMuted ? "Unmute stream audio" : "Mute stream audio"}
                  >
                    {isCustomerAudioMuted ? "🔇 Unmute" : "🔊 Mute"}
                  </button>

                  <div className="volume-control-wrapper">
                    <button
                      onClick={volumeDown}
                      className="volume-control-btn"
                      title="Decrease volume (-10%)"
                      disabled={volume <= 0 || isCustomerAudioMuted}
                    >
                      🔉 -
                    </button>
                    <div className="volume-slider-box">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={isCustomerAudioMuted ? 0 : volume}
                        onChange={(e) => handleVolumeChange(Number(e.target.value))}
                        className="volume-slider"
                        title={`Volume: ${isCustomerAudioMuted ? 0 : volume}%`}
                      />
                      <span className="volume-label">
                        {isCustomerAudioMuted ? "0%" : `${volume}%`}
                      </span>
                    </div>
                    <button
                      onClick={volumeUp}
                      className="volume-control-btn"
                      title="Increase volume (+10%)"
                      disabled={volume >= 100}
                    >
                      🔊 +
                    </button>
                  </div>

                  <button
                    onClick={toggleCustomerVideo}
                    className={`btn-control ${isCustomerVideoOff ? "btn-control-danger" : ""}`}
                    title={isCustomerVideoOff ? "Resume video stream" : "Hide video stream"}
                  >
                    {isCustomerVideoOff ? "📺 Show Video" : "🚫 Hide Video"}
                  </button>

                  <button onClick={enterFullscreen} className="btn-control" title="Toggle Fullscreen">
                    ⛶ Fullscreen
                  </button>
                </div>

                <button
                  onClick={handleCustomerLeave}
                  className="btn-control btn-control-leave"
                  title="Leave live stream"
                >
                  🚪 End & Leave
                </button>
              </div>
            )}

            {/* Mobile Tab Switcher (Visible on small screens) */}
            <div className="mobile-tab-bar">
              <button
                className={`tab-btn ${activeMobileTab === "chat" ? "active" : ""}`}
                onClick={() => setActiveMobileTab("chat")}
              >
                💬 Chat {messages.length > 0 ? `(${messages.length})` : ""}
              </button>
              <button
                className={`tab-btn ${activeMobileTab === "product" ? "active" : ""}`}
                onClick={() => setActiveMobileTab("product")}
              >
                🛍️ Product
              </button>
              {profile?.role === "customer" && (
                <button
                  className={`tab-btn ${activeMobileTab === "cart" ? "active" : ""}`}
                  onClick={() => setActiveMobileTab("cart")}
                >
                  🛒 Cart ({totalCartCount})
                </button>
              )}
            </div>
          </div>

          {/* Right Column / Mobile Tabs: Featured Product, Realtime Chat, and Cart */}
          <aside className="interactive-sidebar">
            {/* Featured Product Card */}
            <div className={`panel-card product-showcase-card ${activeMobileTab !== "product" ? "mobile-hidden" : ""}`}>
              <div className="panel-header">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <h3>Featured Product</h3>
                  {profile?.role === "seller" && session.status === "live" && sellerInventory.length > 1 && (
                    <button
                      onClick={() => setIsProductSwitcherOpen(true)}
                      className="btn-switch-product-pill"
                      title="Switch active featured product live"
                    >
                      🔄 Switch ({sellerInventory.length})
                    </button>
                  )}
                </div>
                <span className="stock-pill">
                  {product ? `${product.stock} available` : ""}
                </span>
              </div>

              {product ? (
                <div className="product-showcase-content">
                  <div className="product-inline-layout">
                    {product.image_url && (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="product-inline-thumb"
                      />
                    )}
                    <div className="product-inline-details">
                      <h4>{product.name}</h4>
                      <p className="product-price-highlight">${product.price}</p>
                    </div>
                  </div>

                  <p className="product-excerpt">{product.description}</p>

                  <div className="product-action-row">
                    <button
                      onClick={() => setIsProductModalOpen(true)}
                      className="btn-secondary btn-sm flex-1"
                    >
                      🔍 View Details
                    </button>
                    {profile?.role === "customer" && (
                      <button
                        onClick={addToCart}
                        disabled={product.stock < 1}
                        className="btn-primary btn-sm flex-1"
                      >
                        {product.stock < 1 ? "Out of Stock" : "🛒 Add to Cart"}
                      </button>
                    )}
                  </div>

                  {profile?.role === "seller" && (
                    <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--border-subtle)" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)" }}>Host Stock Controls:</span>
                      </div>
                      <StockAdjuster
                        productId={product.id}
                        currentStock={product.stock}
                        onStockChange={handleUpdateStock}
                        size="sm"
                        showQuickAdd={true}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="empty-state" style={{ padding: 16 }}>
                  <p className="text-muted">Loading featured product details...</p>
                </div>
              )}
            </div>

            {/* Customer Cart Section */}
            {profile?.role === "customer" && (
              <div className={`panel-card cart-panel-card ${activeMobileTab !== "cart" ? "mobile-hidden" : ""}`}>
                <div className="panel-header">
                  <h3>Your Cart</h3>
                  <span className="cart-total-badge">${cartTotal.toFixed(2)}</span>
                </div>

                <div className="cart-items-list">
                  {cartItems.length === 0 ? (
                    <div className="empty-cart-msg">
                      <p>Your cart is empty.</p>
                      <small>Add items from the featured product above!</small>
                    </div>
                  ) : (
                    cartItems.map((item) => {
                      const itemProd = getJoinedProduct(item);
                      const isMaxStock = itemProd ? item.quantity >= itemProd.stock : false;

                      return (
                        <div key={item.id} className="cart-item-row">
                          <div className="cart-item-info">
                            <strong>{itemProd?.name ?? "Product"}</strong>
                            <span className="cart-item-price">
                              ${itemProd?.price ?? 0} × {item.quantity} = $
                              {((itemProd?.price ?? 0) * item.quantity).toFixed(2)}
                            </span>
                            {itemProd && (
                              <small style={{ color: isMaxStock ? "#dc2626" : "#64748b" }}>
                                {isMaxStock
                                  ? `Max limit reached (${itemProd.stock} available)`
                                  : `${itemProd.stock} available`}
                              </small>
                            )}
                          </div>

                          <div className="cart-item-actions">
                            <button
                              onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                              className="btn-qty"
                              title="Decrease quantity"
                            >
                              -
                            </button>
                            <span className="cart-qty-num">{item.quantity}</span>
                            <button
                              onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                              disabled={isMaxStock}
                              className="btn-qty"
                              style={{ opacity: isMaxStock ? 0.4 : 1, cursor: isMaxStock ? "not-allowed" : "pointer" }}
                              title={isMaxStock ? "Max available stock reached" : "Increase quantity"}
                            >
                              +
                            </button>
                            <button
                              onClick={() => removeCartItem(item.id)}
                              className="btn-remove-item"
                              title="Remove item"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {cartItems.length > 0 && (
                  <div className="cart-footer-summary">
                    <div className="cart-subtotal-row">
                      <span>Total ({totalCartCount} items)</span>
                      <strong>${cartTotal.toFixed(2)}</strong>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Realtime Live Chat */}
            <div className={`panel-card chat-panel-card ${activeMobileTab !== "chat" ? "mobile-hidden" : ""}`}>
              <div className="panel-header">
                <h3>Live Chat</h3>
                <span className="chat-live-dot">● Realtime</span>
              </div>

              <div className="chat-messages-container">
                {messages.length === 0 ? (
                  <div className="empty-chat-msg">
                    <p>No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((chatMsg) => {
                    const isSelf = chatMsg.user_id === user?.id;
                    return (
                      <div
                        key={chatMsg.id}
                        className={`chat-bubble-row ${isSelf ? "chat-row-self" : "chat-row-other"}`}
                      >
                        <div className={`chat-bubble ${isSelf ? "bubble-self" : "bubble-other"}`}>
                          {!isSelf && (
                            <span className="chat-author">
                              {getMessageAuthor(chatMsg)}
                            </span>
                          )}
                          <p className="chat-text">{chatMsg.message}</p>
                          <span className="chat-time">
                            {formatTimestamp(chatMsg.created_at)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatBottomRef} />
              </div>

              {session?.status === "live" ? (
                <form onSubmit={sendMessage} className="chat-input-form">
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onFocus={() => {
                      setTimeout(() => {
                        chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
                      }, 300);
                    }}
                    placeholder="Type a message..."
                    className="chat-input"
                    maxLength={500}
                    autoComplete="off"
                  />
                  <button
                    type="submit"
                    disabled={!messageText.trim()}
                    className="btn-primary chat-send-btn"
                    title="Send Message"
                    aria-label="Send Message"
                  >
                    <span>Send</span>
                    <span className="send-icon-arrow">➤</span>
                  </button>
                </form>
              ) : (
                <div className="chat-disabled-banner">
                  {session?.status === "ended"
                    ? "Chat is closed for ended streams."
                    : "Live chat will activate once broadcast starts."}
                </div>
              )}
            </div>
          </aside>
        </div>

        {/* In-Stream Non-Disruptive Product Modal (A6) */}
        {isProductModalOpen && product && (
          <div className="modal-backdrop" onClick={() => setIsProductModalOpen(false)}>
            <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>{product.name}</h3>
                <button
                  onClick={() => setIsProductModalOpen(false)}
                  className="btn-close-modal"
                >
                  ✕
                </button>
              </div>

              <div className="modal-body">
                {product.image_url && (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="modal-product-img"
                  />
                )}
                <div className="modal-product-meta">
                  <span className="price-tag-lg">${product.price}</span>
                  <span className="stock-tag-lg">
                    {product.stock > 0 ? `${product.stock} In Stock` : "Out of Stock"}
                  </span>
                </div>
                <div className="modal-product-desc">
                  <h4>Product Description</h4>
                  <p>{product.description || "No description provided for this item."}</p>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  onClick={() => setIsProductModalOpen(false)}
                  className="btn-secondary"
                >
                  Close & Keep Watching
                </button>
                {profile?.role === "customer" && (
                  <button
                    onClick={() => {
                      addToCart();
                      setIsProductModalOpen(false);
                    }}
                    disabled={product.stock < 1}
                    className="btn-primary"
                  >
                    Add to Cart (${product.price})
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* In-Stream Product Switcher Modal for Sellers (Part B) */}
        {isProductSwitcherOpen && (
          <div className="modal-backdrop" onClick={() => setIsProductSwitcherOpen(false)}>
            <div className="modal-dialog modal-dialog-switcher" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <h3>Switch Featured Product</h3>
                  <p className="subtitle" style={{ fontSize: "0.82rem", marginTop: 2 }}>
                    Pin any active product from your inventory to the live stream
                  </p>
                </div>
                <button
                  onClick={() => setIsProductSwitcherOpen(false)}
                  className="btn-close-modal"
                >
                  ✕
                </button>
              </div>

              <div className="modal-body switcher-modal-body">
                {sellerInventory.length === 0 ? (
                  <div className="empty-state" style={{ padding: 24 }}>
                    <p className="text-muted">No active products found in your inventory.</p>
                  </div>
                ) : (
                  <div className="switcher-grid">
                    {sellerInventory.map((item) => {
                      const isCurrentlyPinned = item.id === product?.id;
                      return (
                        <div
                          key={item.id}
                          className={`switcher-card ${isCurrentlyPinned ? "switcher-card-pinned" : ""}`}
                        >
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="switcher-card-thumb"
                            />
                          ) : (
                            <div className="switcher-card-placeholder">📦</div>
                          )}

                          <div className="switcher-card-info">
                            <h4>{item.name}</h4>
                            <div className="switcher-card-meta">
                              <span className="switcher-card-price">${item.price}</span>
                              <span className="switcher-card-stock">{item.stock} in stock</span>
                            </div>
                            {profile?.role === "seller" && (
                              <div style={{ marginTop: 6 }}>
                                <StockAdjuster
                                  productId={item.id}
                                  currentStock={item.stock}
                                  onStockChange={handleUpdateStock}
                                  size="sm"
                                  showQuickAdd={true}
                                />
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => handleSwitchFeaturedProduct(item)}
                            disabled={isCurrentlyPinned || isSwitchingProduct}
                            className={`btn-sm ${isCurrentlyPinned ? "btn-secondary" : "btn-primary"}`}
                          >
                            {isCurrentlyPinned ? "✓ Pinned" : "📌 Pin Live"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  onClick={() => setIsProductSwitcherOpen(false)}
                  className="btn-secondary"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default LiveSession;
