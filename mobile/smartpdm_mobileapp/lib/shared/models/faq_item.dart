class FaqItem {
  const FaqItem({
    required this.id,
    required this.question,
    required this.answer,
    this.displayOrder,
  });

  final String id;
  final String question;
  final String answer;
  final int? displayOrder;

  factory FaqItem.fromJson(Map<String, dynamic> json) {
    return FaqItem(
      id: json['id']?.toString() ?? '',
      question: json['question']?.toString().trim() ?? '',
      answer: json['answer']?.toString().trim() ?? '',
      displayOrder: (json['displayOrder'] as num?)?.toInt(),
    );
  }
}
