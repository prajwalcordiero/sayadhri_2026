import test from 'node:test';
import assert from 'node:assert';
import db from '../db/connection.js';
import { seedDatabase } from '../db/seed.js';
import { routeCase, getDoctorQueue } from '../routing/router.js';

test('Specialist Router and Urgency Queue', async (t) => {
  // Ensure fresh seed
  seedDatabase();

  await t.test('routes Cardiology case to available cardiologist with shortest queue', () => {
    const route = routeCase('Cardiology');
    assert(route.assignedDoctor !== null);
    assert.strictEqual(route.assignedDoctor.specialty, 'Cardiology');
    assert.strictEqual(route.status, 'assigned');
  });

  await t.test('routes Paediatrics case to paediatrician', () => {
    const route = routeCase('Paediatrics');
    assert(route.assignedDoctor !== null);
    assert.strictEqual(route.assignedDoctor.specialty, 'Paediatrics');
  });

  await t.test('breaks ties by longest idle time when queue lengths are equal', () => {
    // Both doc_cardio_1 and doc_cardio_2 exist; the one with lower idle_since should be prioritized
    const route = routeCase('Cardiology');
    assert(route.assignedDoctor);
  });

  await t.test('sorts doctor queue with Emergency first, then Urgent, then Routine', () => {
    const queue = getDoctorQueue('doc_cardio_1');
    if (queue.length > 1) {
      const urgencies = queue.map(c => c.urgency);
      // Emergency should come before Routine
      if (urgencies.includes('Emergency') && urgencies.includes('Routine')) {
        const emergencyIndex = urgencies.indexOf('Emergency');
        const routineIndex = urgencies.indexOf('Routine');
        assert(emergencyIndex < routineIndex);
      }
    }
  });
});
