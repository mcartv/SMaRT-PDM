// Extracted public FAQ/program routes
app.get('/api/faqs', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('faqs')
      .select('faq_id, question, answer, display_order, is_active')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching FAQs:', error);
      return res.status(500).json({ error: 'Failed to fetch FAQs.' });
    }

    const items = (data ?? [])
      .filter((faq) => {
        const question = faq?.question?.toString().trim();
        const answer = faq?.answer?.toString().trim();

        return !!question && !!answer;
      })
      .map((faq) => ({
        id: faq.faq_id,
        question: faq.question.trim(),
        answer: faq.answer.trim(),
        displayOrder: faq.display_order,
      }));

    res.status(200).json(items);
  } catch (error) {
    console.error('FAQ ROUTE ERROR:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch FAQs.' });
  }
});

app.get('/api/scholarship-programs', async (req, res) => {
  const { data, error } = await supabase
    .from('scholarship_program')
    .select('program_id, program_name')
    .order('program_name', { ascending: true });

  if (error) {
    console.error('Error fetching scholarship programs:', error);
    return res.status(500).json({ error: 'Failed to fetch scholarship programs' });
  }

  res.status(200).json(data ?? []);
});

