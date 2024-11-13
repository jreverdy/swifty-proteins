import 'package:flutter/material.dart';
import 'package:switfy_proteins/pages/signup.dart';
import 'package:switfy_proteins/widgets/textfield_signup.dart';

Widget loginForm(BuildContext context, GlobalKey<FormState> formKey, TextEditingController usernameController, TextEditingController passwordController) {
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
            onPressed: ()  {
              // verify if user exist and if pwd matches db pwd
              //access to the next page
            },
            child: const Text('log in'),
          ),
          TextButton(
            onPressed: () {
              Navigator.push(
                context, 
                MaterialPageRoute(builder: (context) => const SignupPage())
              );
            }, 
            child: const Text('not sign up ? click here')
          )
        ],
      ),
    )
  );
}