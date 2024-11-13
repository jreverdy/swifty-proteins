import 'package:flutter/material.dart';
import 'package:fluttertoast/fluttertoast.dart';
import 'package:logger/logger.dart';
import 'package:switfy_proteins/utils/register.dart';
import 'package:switfy_proteins/widgets/textfield_signup.dart';

Widget signupForm(GlobalKey<FormState> formKey, TextEditingController usernameController, TextEditingController passwordController) {
  return Center(
    child: Form(
      key: formKey, 
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          textField('username', false, usernameController),
          textField('password', true, passwordController),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.white,
              foregroundColor: Colors.black,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(7),
              ),
            ),
            onPressed: () async {
              if (formKey.currentState!.validate()) {
                try {
                  final res= await register(usernameController.text, passwordController.text);
                  if (res == null){
                    Fluttertoast.showToast(msg: 'This username is already taken.');
                  }
                  //faire redirection login page + petit loading ?
                }
                catch (e) {
                  Logger().e(e);
                }
              }
            },
            child: const Text('Sign up'),
          ),
        ],
      ),
    )
  );
}