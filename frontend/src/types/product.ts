export type product = {
    id: string;
    seller_id: string;
    name: string;
    description: string;
    price: number;
    image_url: string | null;
    stock: number;
    status: string;
    created_at: string;
};