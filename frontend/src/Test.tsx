import { useEffect } from "react";
import { getCurrentProfile } from "./lib/auth";

export function Test() {
  useEffect(() => {
    async function testProfile() {
      try {
        const profile = await getCurrentProfile();

        console.log("Current profile:", profile);
      } catch (error) {
        console.error("Failed to get profile:", error);
      }
    }

    testProfile();
  }, []);

  return (
    <div>
      <h1>Reneo</h1>
    </div>
  );
}
