import 'package:flutter/material.dart';

Widget textField(String hint, bool obscure, TextEditingController controller) {
    return Container(
      margin: const EdgeInsets.fromLTRB(50, 4, 50, 4),
      decoration: BoxDecoration(
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.11),
            blurRadius: 10,
            spreadRadius: 0.0,
          ),
        ],
      ),
      child: TextFormField(
        controller: controller,
        obscureText: obscure,
        style: const TextStyle(
          color: Color.fromARGB(255, 197, 197, 197),
        ),
        decoration: InputDecoration(
          filled: true,
          fillColor: Colors.black.withOpacity(0.3),
          contentPadding: const EdgeInsets.all(15),
          prefixIcon: hint == 'username' ? const Icon(Icons.person) : const Icon(Icons.lock),
          hintText: hint,
          hintStyle: const TextStyle(
            color: Colors.grey,
            fontSize: 14,
          ),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(5),
            borderSide: const BorderSide(
              color: Colors.blue,
              width: 15,
            ),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(5),
            borderSide: const BorderSide(
              color: Colors.blue,
              width: 2,
            ),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(
              color: Colors.white,
              width: 1,
            ),
          ),
        ),
        validator: (value) {
          if (value == null || value.isEmpty) {
            return '$hint can not be empty';
          }
          return null;
        },
      ),
    );
  }
