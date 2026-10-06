// SMaRT-PDM: Announcements — announcement Controller (mobile backend controller); handles mobile API input/output and delegates business logic.
const announcementService = require('../services/announcementService');
const { getSafeStatusCode } = require('../utils/httpStatus');

// getRequestUserId: reads and returns get request user id for the Announcements flow.
function getRequestUserId(req) {
  return req.user?.user_id || req.user?.userId || req.user?.id || null;
}

// getAnnouncements: reads and returns get announcements for the Announcements flow.
async function getAnnouncements(req, res) {
  try {
    const userId = getRequestUserId(req);
    const items = await announcementService.listPublishedAnnouncements(userId);

    return res.status(200).json({ items });
  } catch (error) {
    console.error('GET MOBILE ANNOUNCEMENTS ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to load announcements.',
    });
  }
}

// markAnnouncementViewed: marks mark announcement viewed for the Announcements flow.
async function markAnnouncementViewed(req, res) {
  try {
    const userId = getRequestUserId(req);
    const result = await announcementService.markAnnouncementViewed(
      userId,
      req.params.announcementId
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error('MARK MOBILE ANNOUNCEMENT VIEW ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to record announcement view.',
    });
  }
}

module.exports = {
  getAnnouncements,
  markAnnouncementViewed,
};
