import 'package:smartpdm_mobileapp/shared/models/faq_item.dart';
import 'package:smartpdm_mobileapp/core/networking/api_client.dart';

class FaqService {
  FaqService({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  final ApiClient _apiClient;

  Future<List<FaqItem>> fetchFaqs() async {
    final response = await _apiClient.getList('/api/faqs');

    return response
        .map((item) {
          if (item is Map<String, dynamic>) {
            return item;
          }
          if (item is Map) {
            return item.map((key, value) => MapEntry(key.toString(), value));
          }
          return <String, dynamic>{};
        })
        .where((item) => item.isNotEmpty)
        .map(FaqItem.fromJson)
        .where(
          (item) =>
              item.id.isNotEmpty &&
              item.question.isNotEmpty &&
              item.answer.isNotEmpty,
        )
        .toList();
  }
}
