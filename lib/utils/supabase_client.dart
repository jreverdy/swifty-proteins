import 'package:supabase_flutter/supabase_flutter.dart';

class SupabaseClientSingleton {
  static final SupabaseClient _supabaseClient = Supabase.instance.client;
  static SupabaseClient get client => _supabaseClient;
}

