package com.vbalaichau.quiz

import io.flutter.embedding.android.FlutterFragmentActivity

// FlutterFragmentActivity (không phải FlutterActivity) — bắt buộc cho
// local_auth: plugin dùng androidx.biometric.BiometricPrompt, cần FragmentActivity.
class MainActivity : FlutterFragmentActivity()
