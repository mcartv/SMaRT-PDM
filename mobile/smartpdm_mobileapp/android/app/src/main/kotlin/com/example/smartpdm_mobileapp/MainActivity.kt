package com.example.smartpdm_mobileapp

import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.recaptcha.Recaptcha
import com.google.android.recaptcha.RecaptchaAction
import com.google.android.recaptcha.RecaptchaTasksClient
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    companion object {
        private const val CHANNEL_NAME = "smartpdm/recovery_captcha"
        private const val EXECUTE_TIMEOUT_MS = 10_000L
    }

    private var recaptchaClient: RecaptchaTasksClient? = null
    private var recaptchaSiteKey: String? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            CHANNEL_NAME,
        ).setMethodCallHandler { call, result ->
            when (call.method) {
                "executeCaptcha" -> {
                    val siteKey = call.argument<String>("siteKey").orEmpty().trim()
                    val actionName = call.argument<String>("action").orEmpty().trim()

                    if (siteKey.isEmpty()) {
                        result.error(
                            "missing_site_key",
                            "The Android reCAPTCHA site key is missing.",
                            null,
                        )
                        return@setMethodCallHandler
                    }

                    if (actionName.isEmpty()) {
                        result.error(
                            "missing_action",
                            "The recovery action name is missing.",
                            null,
                        )
                        return@setMethodCallHandler
                    }

                    executeCaptcha(siteKey, actionName, result)
                }

                else -> result.notImplemented()
            }
        }
    }

    private fun executeCaptcha(
        siteKey: String,
        actionName: String,
        result: MethodChannel.Result,
    ) {
        ensureRecaptchaClient(siteKey, result) { client ->
            client.executeTask(RecaptchaAction.custom(actionName), EXECUTE_TIMEOUT_MS)
                .addOnSuccessListener(this) { token ->
                    result.success(token)
                }
                .addOnFailureListener(this) { error ->
                    respondWithRecaptchaError(error, result)
                }
        }
    }

    private fun ensureRecaptchaClient(
        siteKey: String,
        result: MethodChannel.Result,
        onReady: (RecaptchaTasksClient) -> Unit,
    ) {
        val cachedClient = recaptchaClient
        if (cachedClient != null && recaptchaSiteKey == siteKey) {
            onReady(cachedClient)
            return
        }

        Recaptcha.fetchTaskClient(application, siteKey)
            .addOnSuccessListener(this) { client ->
                recaptchaClient = client
                recaptchaSiteKey = siteKey
                onReady(client)
            }
            .addOnFailureListener(this) { error ->
                respondWithRecaptchaError(error, result)
            }
    }

    private fun respondWithRecaptchaError(
        error: Exception,
        result: MethodChannel.Result,
    ) {
        val code = when (error) {
            is ApiException -> when (error.statusCode) {
                CommonStatusCodes.CANCELED -> "captcha_cancelled"
                CommonStatusCodes.TIMEOUT -> "captcha_timeout"
                else -> "captcha_provider_failure"
            }

            else -> {
                val message = error.message.orEmpty().lowercase()
                when {
                    "cancel" in message -> "captcha_cancelled"
                    "timeout" in message -> "captcha_timeout"
                    else -> "captcha_provider_failure"
                }
            }
        }

        val message = when (code) {
            "captcha_cancelled" -> "The security challenge was cancelled."
            "captcha_timeout" -> "The security challenge timed out. Please try again."
            else -> error.message ?: "Unable to complete the security challenge."
        }

        result.error(code, message, null)
    }
}
