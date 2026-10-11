exports.activateAcademicPeriod = async (
    periodId,
    actorUserId = null
) => {
    await assertCurrentAcademicYear(
            client,
            Number(period.start_year),
            Number(period.end_year)
        );
};
exports.resetAcademicPeriodForTesting = async () => {};
