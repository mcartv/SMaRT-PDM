const courseService = require('../services/courseService');
const auditLogService = require('../services/auditLogService');
const socketEvents = require('../utils/socketEvents');

function sendError(res, error, fallbackMessage) {
    const message = error?.message || fallbackMessage || 'Unknown backend error';

    if (
        message === 'Course code is required' ||
        message === 'Course name is required'
    ) {
        return res.status(400).json({
            message,
            error: message,
        });
    }

    if (message === 'Course code already exists') {
        return res.status(409).json({
            message,
            error: message,
        });
    }

    return res.status(500).json({
        message: fallbackMessage,
        error: message,
    });
}

function emitCourseUpdate(req, action, course = null) {
    const io = req.app.get('io');

    const payload = {
        module: 'courses',
        action,
        id: course?.course_id || null,
        course,
        updated_at: new Date().toISOString(),
    };

    if (socketEvents?.maintenanceUpdated) {
        socketEvents.maintenanceUpdated(io, payload);
        return;
    }

    if (io) {
        io.emit('maintenance:updated', payload);
    }
}

const getCourses = async (req, res) => {
    try {
        const courses = await courseService.fetchCourses();
        return res.status(200).json(courses);
    } catch (error) {
        console.error('GET COURSES CONTROLLER ERROR:', error);
        return sendError(res, error, 'Failed to fetch courses');
    }
};

const createCourse = async (req, res) => {
    await auditLogService.logAudit({
        req,
        actionTaken: 'CREATE_COURSE',
        module: 'Courses',
        entityType: 'academic_course',
        entityId: course?.course_id || null,
        description: `Created course: ${course?.course_code || ''} ${course?.course_name || ''}`.trim(),
        metadata: {
            course_id: course?.course_id || null,
            course_code: course?.course_code || null,
            course_name: course?.course_name || null,
        },
    });

    try {
        const createdCourse = await courseService.createCourse({
            course_code: req.body.course_code,
            course_name: req.body.course_name,
            is_archived: req.body.is_archived,
        });

        emitCourseUpdate(req, 'create', createdCourse);

        return res.status(201).json(createdCourse);
    } catch (error) {
        console.error('CREATE COURSE CONTROLLER ERROR:', error);
        return sendError(res, error, 'Failed to create course');
    }
};

const updateCourse = async (req, res) => {
    await auditLogService.logAudit({
        req,
        actionTaken: 'UPDATE_COURSE',
        module: 'Courses',
        entityType: 'academic_course',
        entityId: course?.course_id || req.params.id,
        description: `Updated course: ${course?.course_code || req.params.id}.`,
        metadata: {
            course_id: course?.course_id || req.params.id,
            changes: req.body,
        },
    });

    try {
        const updatedCourse = await courseService.updateCourse(req.params.id, {
            course_code: req.body.course_code,
            course_name: req.body.course_name,
            is_archived: req.body.is_archived,
        });

        if (!updatedCourse) {
            return res.status(404).json({
                message: 'Course not found',
                error: 'Course not found',
            });
        }

        emitCourseUpdate(req, 'update', updatedCourse);

        return res.status(200).json(updatedCourse);
    } catch (error) {
        console.error('UPDATE COURSE CONTROLLER ERROR:', error);
        return sendError(res, error, 'Failed to update course');
    }
};

const archiveCourse = async (req, res) => {
    await auditLogService.logAudit({
        req,
        actionTaken: course?.is_archived ? 'ARCHIVE_COURSE' : 'RESTORE_COURSE',
        module: 'Courses',
        entityType: 'academic_course',
        entityId: course?.course_id || req.params.id,
        description: `${course?.is_archived ? 'Archived' : 'Restored'} course: ${course?.course_code || req.params.id}.`,
        metadata: {
            course_id: course?.course_id || req.params.id,
            course_code: course?.course_code || null,
            is_archived: course?.is_archived,
        },
    });

    try {
        const archivedCourse = await courseService.archiveCourse(req.params.id);

        if (!archivedCourse) {
            return res.status(404).json({
                message: 'Course not found',
                error: 'Course not found',
            });
        }

        emitCourseUpdate(req, 'archive', archivedCourse);

        return res.status(200).json(archivedCourse);
    } catch (error) {
        console.error('ARCHIVE COURSE CONTROLLER ERROR:', error);
        return sendError(res, error, 'Failed to archive course');
    }
};

const restoreCourse = async (req, res) => {
    await auditLogService.logAudit({
        req,
        actionTaken: course?.is_archived ? 'ARCHIVE_COURSE' : 'RESTORE_COURSE',
        module: 'Courses',
        entityType: 'academic_course',
        entityId: course?.course_id || req.params.id,
        description: `${course?.is_archived ? 'Archived' : 'Restored'} course: ${course?.course_code || req.params.id}.`,
        metadata: {
            course_id: course?.course_id || req.params.id,
            course_code: course?.course_code || null,
            is_archived: course?.is_archived,
        },
    });
    
    try {
        const restoredCourse = await courseService.restoreCourse(req.params.id);

        if (!restoredCourse) {
            return res.status(404).json({
                message: 'Course not found',
                error: 'Course not found',
            });
        }

        emitCourseUpdate(req, 'restore', restoredCourse);

        return res.status(200).json(restoredCourse);
    } catch (error) {
        console.error('RESTORE COURSE CONTROLLER ERROR:', error);
        return sendError(res, error, 'Failed to restore course');
    }
};

module.exports = {
    getCourses,
    createCourse,
    updateCourse,
    archiveCourse,
    restoreCourse,
};