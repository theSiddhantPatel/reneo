import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.SUPABASE_URL!;

const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY!;

if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Supabase environment variables are missing.");
}

export function createAuthenticatedSupabaseClient(
    accessToken: string
) {
    return createClient(
        supabaseUrl,
        supabasePublishableKey,
        {
            global: {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            },
        }
    );
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey);
// // export default supabase;
/* there is a problem with this export so we are changing the structure like the above. 
we are passing accesstoken inside supabase client
user id c88a1704-6c60-4936-aca1-b5e1d0db62dd 
Profile: null Profile error: { code: '42501', details: null, 
hint: 'Grant the required privileges to the current role with: 
GRANT SELECT ON public.profiles TO anon;', 
message: 'permission denied for table profiles' }

 */
