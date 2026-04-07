const courseService = require('../services/courseService');

const getCourses = async (req, res) => {
    try {
        const courses = await courseService.fetchCourses();
        res.status(200).json(courses);
    } catch (error) {
        console.error('GET COURSES CONTROLLER ERROR:', error);
        res.status(500).json({
            error: 'Failed to fetch courses',
        });
    }
};

const createCourse = async (req, res) => {
    try {
        const {
            course_code,
            course_name,
            department,
            is_archived,
        } = req.body;

        const createdCourse = await courseService.createCourse({
            course_code,
            course_name,
            department,
            is_archived,
        });

        res.status(201).json(createdCourse);
    } catch (error) {
        console.error('CREATE COURSE CONTROLLER ERROR:', error);

        if (error.message === 'Course code is required' ||
            error.message === 'Course name is required' ||
            error.message === 'Department is required') {
            return res.status(400).json({ error: error.message });
        }

        if (error.message === 'Course code already exists') {
            return res.status(409).json({ error: error.message });
        }

        res.status(500).json({
            error: 'Failed to create course',
        });
    }
};

const updateCourse = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            course_code,
            course_name,
            department,
            is_archived,
        } = req.body;

        const updatedCourse = await courseService.updateCourse(id, {
            course_code,
            course_name,
            department,
            is_archived,
        });

        if (!updatedCourse) {
            return res.status(404).json({
                error: 'Course not found',
            });
        }

        res.status(200).json(updatedCourse);
    } catch (error) {
        console.error('UPDATE COURSE CONTROLLER ERROR:', error);

        if (error.message === 'Course code already exists') {
            return res.status(409).json({ error: error.message });
        }

        res.status(500).json({
            error: 'Failed to update course',
        });
    }
};

module.exports = {
    getCourses,
    createCourse,
    updateCourse,
};