"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureSupabaseClient = exports.supabaseClient = void 0;
/**
 * Supabase client factory.
 * Centralizes environment variable handling for client-side Supabase usage.
 */
var supabase_js_1 = require("@supabase/supabase-js");
var supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
var supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
exports.supabaseClient = supabaseUrl && supabaseAnonKey
    ? (0, supabase_js_1.createClient)(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
        },
    })
    : null;
/**
 * Ensure a Supabase client exists and surface a descriptive error when env vars are missing.
 */
var ensureSupabaseClient = function () {
    if (!exports.supabaseClient) {
        throw new Error("Supabase env vars missing: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }
    return exports.supabaseClient;
};
exports.ensureSupabaseClient = ensureSupabaseClient;
