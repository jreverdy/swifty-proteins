import 'package:flutter/material.dart';
import 'package:switfy_proteins/pages/login.dart';
import 'package:switfy_proteins/utils/initialize_database.dart';


Future<void> main() async {
  await initializeDatabase();
  // await register('jeremy', 'pass');
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      debugShowCheckedModeBanner: false,
      home: LoginPage(),
    );
  }
}
