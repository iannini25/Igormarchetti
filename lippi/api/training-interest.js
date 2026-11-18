import {takeRate} from './_lib/survey.js';
import {trainingDatabase} from './_lib/training-database.js';
import {createTrainingService} from './_lib/training-interest.js';

export const trainingService = createTrainingService({query: (...args) => trainingDatabase.query(...args), transaction: work => trainingDatabase.transaction(work), takeRate});
export default trainingService.submit;
