import { Router } from 'express';
import * as pdmsController from './pdmsController.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
const router = Router();
// HR2 -> PDMS Workforce Records Ingest (supports integration push & WFM sync)
router.post('/workforce-records', pdmsController.ingestWorkforceRecords);
router.get('/workforce-records', authenticate, pdmsController.getWorkforceRecords);
router.post('/workforce-records/sync-from-wfm', authenticate, authorize(['superadmin', 'hr_admin']), pdmsController.syncWorkforceFromWfm);
// PDMS Dashboard & Core Endpoints
router.get('/dashboard', authenticate, pdmsController.getDashboard);
router.get('/competencies', authenticate, pdmsController.getCompetencies);
router.post('/competencies', authenticate, authorize(['superadmin', 'hr_admin']), pdmsController.createCompetency);
router.get('/goals', authenticate, pdmsController.getGoals);
router.post('/goals', authenticate, pdmsController.createGoal);
router.get('/kpis', authenticate, pdmsController.getKpis);
router.post('/kpis', authenticate, authorize(['superadmin', 'hr_admin']), pdmsController.createKpi);
router.get('/performance-reviews', authenticate, pdmsController.getPerformanceReviews);
router.post('/performance-reviews', authenticate, authorize(['superadmin', 'hr_admin']), pdmsController.createPerformanceReview);
router.get('/courses', authenticate, pdmsController.getCourses);
router.get('/trainings', authenticate, pdmsController.getTrainings);
router.get('/succession-positions', authenticate, pdmsController.getSuccessionPositions);
router.get('/recognitions', authenticate, pdmsController.getRecognitions);
router.post('/recognitions', authenticate, pdmsController.createRecognition);
export default router;
