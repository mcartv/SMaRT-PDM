const supabase = require('../config/supabase');

function mapRO(row, requiredHours, now = new Date()) {
    const deadline = row.deadline_date ? new Date(row.deadline_date) : null;

    let computedStatus = row.ro_status;
    if (row.ro_status === 'Pending' && deadline && deadline < now) {
        computedStatus = 'Overdue';
    }

    return {
        id: row.ro_id,
        scholarId: row.scholar_id,
        student: {
            name: row.student_name || 'Unknown Student',
            id: row.student_number || 'N/A',
            program: row.program_name || 'Scholar',
        },
        obligation: row.task_description,
        type: row.department_assigned ? 'Assigned Duty' : 'General RO',
        submitted: row.submitted_at,
        dueDate: row.deadline_date,
        doc: row.proof_file_url || '',
        dept: row.department_assigned || 'Unassigned',
        hoursLogged: row.rendered_hours || 0,
        carryOver: !!row.is_carry_over,
        prevSem: row.previous_semester || '',
        status: computedStatus,
        rejectionReason: row.rejection_reason || '',
        verifiedDate: row.verified_at || null,
        requiredHours,
    };
}

exports.getConfig = async () => {
    return {
        currentSemester: '1st Sem AY 2025-26',
        requiredHours: 20,
        history: [
            { sem: '2nd Sem AY 2023-24', required: 50 },
            { sem: '1st Sem AY 2024-25', required: 20 },
            { sem: '2nd Sem AY 2024-25', required: 20 },
        ],
    };
};

exports.updateConfig = async (payload) => {
    const { currentSemester, requiredHours } = payload || {};

    return {
        currentSemester: currentSemester || '1st Sem AY 2025-26',
        requiredHours: Number(requiredHours || 20),
        history: [
            { sem: '2nd Sem AY 2023-24', required: 50 },
            { sem: '1st Sem AY 2024-25', required: 20 },
            { sem: '2nd Sem AY 2024-25', required: 20 },
        ],
    };
};

exports.getSummary = async () => {
    const { data, error } = await supabase
        .rpc('get_ro_summary_view')
        .select('*');

    if (error) {
        // fallback if RPC/view doesn't exist
        const { data: rows, error: rowError } = await supabase
            .from('return_of_obligations')
            .select('ro_status, is_carry_over, deadline_date');

        if (rowError) throw new Error(rowError.message);

        const now = new Date();
        let pending = 0;
        let verified = 0;
        let overdue = 0;
        let carryOver = 0;

        for (const row of rows || []) {
            if (row.is_carry_over) carryOver++;

            if (row.ro_status === 'Verified') verified++;
            else if (row.ro_status === 'Pending') {
                if (row.deadline_date && new Date(row.deadline_date) < now) overdue++;
                else pending++;
            } else if (row.ro_status === 'Overdue') overdue++;
        }

        return {
            pending,
            verified,
            overdue,
            carryOver,
            requiredHours: 20,
            currentSemester: '1st Sem AY 2025-26',
        };
    }

    return data?.[0] || {
        pending: 0,
        verified: 0,
        overdue: 0,
        carryOver: 0,
        requiredHours: 20,
        currentSemester: '1st Sem AY 2025-26',
    };
};

exports.getROList = async (status = 'pending') => {
    const { data, error } = await supabase
        .from('return_of_obligations')
        .select(`
            ro_id,
            scholar_id,
            department_assigned,
            task_description,
            required_hours,
            rendered_hours,
            ro_status,
            deadline_date,
            proof_file_url,
            admin_note,
            rejection_reason,
            is_carry_over,
            previous_semester,
            assigned_at,
            submitted_at,
            verified_at,
            scholars (
                scholar_id,
                students (
                    pdm_id,
                    first_name,
                    last_name
                ),
                scholarship_program (
                    program_name
                )
            )
        `)
        .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    const config = await exports.getConfig();
    const now = new Date();

    const rows = (data || []).map((row) => ({
        ...row,
        student_name: row.scholars?.students
            ? `${row.scholars.students.first_name} ${row.scholars.students.last_name}`.trim()
            : 'Unknown Student',
        student_number: row.scholars?.students?.pdm_id || 'N/A',
        program_name: row.scholars?.scholarship_program?.program_name || 'Scholar',
    }));

    const mapped = rows.map((row) => mapRO(row, config.requiredHours, now));

    if (status === 'pending') return mapped.filter((r) => r.status === 'Pending');
    if (status === 'verified') return mapped.filter((r) => r.status === 'Verified');
    if (status === 'overdue') return mapped.filter((r) => r.status === 'Overdue');

    return mapped;
};

exports.createRO = async (payload, user) => {
    const {
        scholarId,
        departmentAssigned,
        taskDescription,
        requiredHours,
        renderedHours = 0,
        deadlineDate,
        isCarryOver = false,
        previousSemester = null,
    } = payload || {};

    if (!scholarId || !taskDescription || !requiredHours || !deadlineDate) {
        throw new Error('Scholar, task description, required hours, and deadline date are required');
    }

    const { data, error } = await supabase
        .from('return_of_obligations')
        .insert({
            scholar_id: scholarId,
            department_assigned: departmentAssigned || null,
            task_description: taskDescription,
            required_hours: Number(requiredHours),
            rendered_hours: Number(renderedHours || 0),
            ro_status: 'Pending',
            deadline_date: deadlineDate,
            is_carry_over: !!isCarryOver,
            previous_semester: previousSemester,
            assigned_by: user?.userId || null,
            assigned_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .select()
        .single();

    if (error) throw new Error(error.message);

    return data;
};

exports.approveRO = async (roId, user) => {
    const { data, error } = await supabase
        .from('return_of_obligations')
        .update({
            ro_status: 'Verified',
            verified_by: user?.userId || null,
            verified_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('ro_id', roId)
        .select()
        .single();

    if (error) throw new Error(error.message);

    return data;
};

exports.rejectRO = async (roId, payload, user) => {
    const { reason = '' } = payload || {};

    const { data, error } = await supabase
        .from('return_of_obligations')
        .update({
            ro_status: 'Rejected',
            rejection_reason: reason,
            rejected_by: user?.userId || null,
            rejected_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('ro_id', roId)
        .select()
        .single();

    if (error) throw new Error(error.message);

    return data;
};

exports.assignDepartment = async (roId, payload) => {
    const { departmentAssigned } = payload || {};

    if (!departmentAssigned) {
        throw new Error('Department is required');
    }

    const { data, error } = await supabase
        .from('return_of_obligations')
        .update({
            department_assigned: departmentAssigned,
            updated_at: new Date().toISOString(),
        })
        .eq('ro_id', roId)
        .select()
        .single();

    if (error) throw new Error(error.message);

    return data;
};