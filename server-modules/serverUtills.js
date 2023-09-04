const {
    UNPUNISHABLE_REPEAT_TIMES,
    REPEAT_TIMES_CONVERT_TO_POINTS,
    PUNISHMENT_POINTS_CONVERTED_FROM_REPEAT_TIMES,
    MAX_PUNISHMENT_FOR_LATE_PRACTICE,
} = require('./serverConstants');

const getHoursSinceRepeat = (repeatedTimeStamp) => {
    const timeSinceRepeat = Date.now() - repeatedTimeStamp;
    return Math.floor(timeSinceRepeat/ (1000*60*60));
}

const countPunishmentPoints = (timesBeenRepeated, lastTimeRepeted) => {
    let punishPoints = 0;
    for (let i = 0; i <= MAX_PUNISHMENT_FOR_LATE_PRACTICE; i++) {
        if ((getHoursSinceRepeat(lastTimeRepeted) - (REPEAT_TIMES_CONVERT_TO_POINTS[timesBeenRepeated - i]?? 0)) >= 1) {
            punishPoints += 1;
        } 
    }
    return punishPoints;
}

const getPunishmentForLatePractice = (timesBeenRepeated, lastTimeRepeted) => {
    const newTimesBeenRepeated = timesBeenRepeated - countPunishmentPoints(timesBeenRepeated, lastTimeRepeted);
    if (timesBeenRepeated >= UNPUNISHABLE_REPEAT_TIMES) {
        return (newTimesBeenRepeated <= UNPUNISHABLE_REPEAT_TIMES? UNPUNISHABLE_REPEAT_TIMES: newTimesBeenRepeated); 
    }

    return (newTimesBeenRepeated <= 0? 0: newTimesBeenRepeated);
}

const validateAllRequestData = (validationSchema) => {
    return validationSchema.every(validationItem => {
        const value = validationItem[0];
        const funcToValidateValue = validationItem[1];
        const regEx = validationItem[2]
        
        return regEx? funcToValidateValue( value, regEx): funcToValidateValue(value);
    })
}


const convertHoursToSeconds = (hours) => {
    return hours*1000*60*60;
}

const validateString = (str) => typeof str === 'string';
const validateBoolean = (bool) => typeof bool === 'boolean';
const validateNumber = (number) => typeof number === 'number';
const validateIsArray = (array) => Array.isArray(array);
const validateWithRegEx = (val, regEx) => regEx.test(val);


const countPenalty = (hoursSinceLastPractice, practiceCount, maximumPenalty) => {
    
    const isTimeForPracticeExpaired = (REPEAT_TIMES_CONVERT_TO_POINTS[practiceCount] - hoursSinceLastPractice) <= 0;

    if (isTimeForPracticeExpaired && maximumPenalty && hoursSinceLastPractice) {
        const repeatTimesCompensateHours = (PUNISHMENT_POINTS_CONVERTED_FROM_REPEAT_TIMES[practiceCount]?? 0) - (PUNISHMENT_POINTS_CONVERTED_FROM_REPEAT_TIMES[practiceCount - 1]?? 0)
        
        const addingHoursDueToPenalty = repeatTimesCompensateHours;
        const penaltyAmount = 1;
        
        const isPracticeCountDecreasedToMinimum = practiceCount - penaltyAmount <= 0;
        const isPenaltyCountDecreasedToMinimum = maximumPenalty <= 1;

        if (isPracticeCountDecreasedToMinimum || isPenaltyCountDecreasedToMinimum) {
            return [addingHoursDueToPenalty, penaltyAmount];
        } else {
            const nextRoundCountPenalty = countPenalty((hoursSinceLastPractice - addingHoursDueToPenalty), (practiceCount - penaltyAmount), maximumPenalty - penaltyAmount);

            const nextRoundAddingHoursDueToPenalty = nextRoundCountPenalty[0];
            const nextRoundPenaltyAmount = nextRoundCountPenalty[1];

            return [addingHoursDueToPenalty + nextRoundAddingHoursDueToPenalty, penaltyAmount + nextRoundPenaltyAmount];
        }
    }

    return [0, 0];
}

const getPenaltyForLatePractice = (hoursSinceLastPractice, practiceCount, maximumPenalty) => {
    const [addingHoursDueToPenalty, penaltyCount] = countPenalty(hoursSinceLastPractice, practiceCount, maximumPenalty);
    return {penaltyCount: penaltyCount, addingHoursDueToPenalty: addingHoursDueToPenalty}
}

const applyPunishmentForCollection = (collectionBeforePunishing) => {
    return (collectionBeforePunishing.collectionData.map((card) => {
        const timesBeenRepeated = card.collectionItemTimesBeenRepeated;
        const hoursSinceLastPractice = getHoursSinceRepeat(card.collectionItemRepeatedTimeStamp);
        const maximumPenalty = timesBeenRepeated - (card.collectionItemInvincibleCount?? 0);
        const {penaltyCount, addingHoursDueToPenalty} = getPenaltyForLatePractice(hoursSinceLastPractice, timesBeenRepeated, maximumPenalty);
        
        
        card.collectionItemTimesBeenRepeated = timesBeenRepeated - penaltyCount;
        card.collectionItemRepeatedTimeStamp += convertHoursToSeconds(addingHoursDueToPenalty);

        card.collectionItemPenaltyCount = penaltyCount;
        
        return card
    }))
}

module.exports = {
    getHoursSinceRepeat,
    countPunishmentPoints,
    getPunishmentForLatePractice,
    validateAllRequestData,
    convertHoursToSeconds,
    validateString,
    validateBoolean,
    validateNumber,
    validateIsArray,
    validateWithRegEx,
    getPenaltyForLatePractice,
    applyPunishmentForCollection
}