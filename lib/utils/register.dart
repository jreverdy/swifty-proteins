import 'package:logger/logger.dart';
import 'package:bcrypt/bcrypt.dart';
import 'supabase_client.dart';

Future<String?> register(String username, String password) async {
  String hashPwd = BCrypt.hashpw(password, BCrypt.gensalt());
  final client = SupabaseClientSingleton.client;
  try {
    await client
        .from('profiles')
        .insert({
          'username': username,
          'password': hashPwd,
        });
      return 'success';
  }
   catch (e) {
    Logger().e(e);
    return null;
   }
}