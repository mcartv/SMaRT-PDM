const supabase = require('../config/supabase');
const _ = require('lodash');

exports.getApplications = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('applications')
            .select(`
                application_id,
                application_status,
                submission_date,
                deficiency_status,
                loi_content,
                is_disqualified,
                disqualification_reason,
                students ( first_name, last_name, pdm_id, gwa ),
                scholarship_programs ( program_name )
            `);

        if (error) {
            console.error("Supabase Fetch Error:", error);
            throw error;
        }

        const processed = _.map(data, (app) => ({
            id: app.application_id,
            // Safely merge names even if students record is missing
            name: `${_.get(app, 'students.last_name', 'Unknown')}, ${_.get(app, 'students.first_name', 'Student')}`,
            student_number: _.get(app, 'students.pdm_id', 'N/A'),
            program: _.get(app, 'scholarship_programs.program_name', 'General'),

            submitted: app.submission_date,

            status: _.toLower(app.application_status),
            deficiency: _.toLower(app.deficiency_status),
            disqualified: app.is_disqualified,
            disqReason: app.disqualification_reason,

            loi_content: app.loi_content,

            gwa: _.get(app, 'students.gwa', 0)
        }));

        const sorted = _.orderBy(processed, ['submitted'], ['desc']);

        res.status(200).json(sorted);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.disqualifyApplication = async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    try {
        const { data, error } = await supabase
            .from('applications')
            .update({
                is_disqualified: true,
                disqualification_reason: reason,
                application_status: 'missing'
            })
            .eq('application_id', id)
            .select();

        if (error) {
            console.error("Supabase Update Error:", error);
            throw error;
        }

        res.status(200).json({ message: 'Application disqualified successfully', data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};