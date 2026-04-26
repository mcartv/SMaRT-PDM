const supabase = require('../config/supabase');

async function getCourses() {
    const { data, error } = await supabase
        .from('academic_course')
        .select('course_id, course_code, course_name, is_archived')
        .eq('is_archived', false)
        .not('course_code', 'is', null)
        .not('course_name', 'is', null)
        .order('course_code', { ascending: true });

    if (error) {
        throw error;
    }

    const items = (data || [])
        .filter((course) => {
            const code = String(course.course_code || '').trim();
            const name = String(course.course_name || '').trim();
            return code.length > 0 && name.length > 0;
        })
        .map((course) => ({
            course_id: course.course_id,
            course_code: String(course.course_code || '').trim(),
            course_name: String(course.course_name || '').trim(),
            label: `${String(course.course_code || '').trim()} - ${String(course.course_name || '').trim()}`,
        }));

    return { items };
}

module.exports = {
    getCourses,
};