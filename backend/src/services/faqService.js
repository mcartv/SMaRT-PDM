const supabase = require('../config/supabase');

async function getActiveFaqs() {
    const { data, error } = await supabase
        .from('faqs')
        .select('faq_id, question, answer, display_order')
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .order('faq_id', { ascending: true });

    if (error) {
        throw error;
    }

    return (data || [])
        .map((faq) => ({
            id: String(faq?.faq_id || '').trim(),
            question: String(faq?.question || '').trim(),
            answer: String(faq?.answer || '').trim(),
            displayOrder: Number.isFinite(Number(faq?.display_order))
                ? Number(faq.display_order)
                : null,
        }))
        .filter((faq) => faq.id && faq.question && faq.answer);
}

module.exports = {
    getActiveFaqs,
};
