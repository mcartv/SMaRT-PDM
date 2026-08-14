import 'package:smartpdm_mobileapp/core/networking/api_client.dart';
import 'package:smartpdm_mobileapp/core/networking/api_exception.dart';
import 'package:smartpdm_mobileapp/shared/models/faq_item.dart';

class FaqService {
  FaqService({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  final ApiClient _apiClient;

  Future<List<FaqItem>> fetchFaqs() async {
    try {
      final settings = await _apiClient.getObject('/api/general-settings/public');
      final rawFaqs = settings['landing_faqs'];

      if (rawFaqs is List) {
        return _parseFaqs(rawFaqs);
      }

      return const [];
    } on ApiException catch (error) {
      // The project currently has two backend layouts. The deployed Admin
      // backend exposes /api/general-settings/public, while the modular
      // backend exposes /api/faqs. Fall back only when the first route does
      // not exist so real server errors are not hidden.
      if (error.statusCode != 404) {
        rethrow;
      }

      final response = await _apiClient.getList('/api/faqs');
      return _parseFaqs(response);
    }
  }

  List<FaqItem> _parseFaqs(List<dynamic> rawFaqs) {
    final items = <FaqItem>[];

    for (var index = 0; index < rawFaqs.length; index++) {
      final rawItem = rawFaqs[index];

      Map<String, dynamic> item;
      if (rawItem is Map<String, dynamic>) {
        item = rawItem;
      } else if (rawItem is Map) {
        item = rawItem.map(
          (key, value) => MapEntry(key.toString(), value),
        );
      } else {
        continue;
      }

      if (item['is_archived'] == true) {
        continue;
      }

      final normalized = <String, dynamic>{
        ...item,
        'id':
            item['id']?.toString().trim().isNotEmpty == true
                ? item['id'].toString().trim()
                : item['faq_id']?.toString().trim() ?? '',
        'displayOrder':
            item['displayOrder'] ??
            item['display_order'] ??
            (index + 1),
      };

      final faq = FaqItem.fromJson(normalized);

      if (faq.id.isNotEmpty &&
          faq.question.isNotEmpty &&
          faq.answer.isNotEmpty) {
        items.add(faq);
      }
    }

    return items;
  }
}
