import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ghtycmzmlrwcqvqdculz.supabase.co";
const supabaseKey = "sb_publishable_PxhIvgqIb9chfl1axSigwg_dSVkWcG5";

export const supabase = createClient(supabaseUrl, supabaseKey);