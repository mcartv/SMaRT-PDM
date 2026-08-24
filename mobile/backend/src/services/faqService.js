const supabase = require('../config/supabase');

const GENERAL_SETTINGS_ID = 1;
const MAX_FAQS = 20;

function normalizeFaqItem(item, index) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return null;
    }

    if (item.is_archived === true) {
        return null;
    }

    const question = String(item.question || '').trim();
    const answer = String(item.answer || '').trim();

    if (!question || !answer) {
        return null;
    }

    const rawId = String(item.faq_id || '').trim();
    const id = rawId || `faq-${index + 1}`;

    return {
        id,
        question,
        answer,
        displayOrder: index + 1,
    };
}

async function getActiveFaqs() {
    const { data, error } = await supabase
        .from('general_settings')
        .select('landing_faqs')
        .eq('general_settings_id', GENERAL_SETTINGS_ID)
        .maybeSingle();

    if (error) {
        throw error;
    }

    const rawFaqs = Array.isArray(data?.landing_faqs)
        ? data.landing_faqs
        : [];

    return rawFaqs
        .slice(0, MAX_FAQS)
        .map(normalizeFaqItem)
        .filter(Boolean);
}

module.exports = {
    getActiveFaqs,
};
