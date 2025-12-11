// Test script for client creation flow
// This tests that new users can create clients and access them

const SUPABASE_URL = 'https://vekxzuupejmitvwwokrf.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZla3h6dXVwZWptaXR2d3dva3JmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTA0Mjc0OSwiZXhwIjoyMDgwNjE4NzQ5fQ.hmQ674mn88jXf9LV2NLDsL3GlgSd_IBP8Cr9HfTHdSQ';
const LOCAL_API_URL = 'http://localhost:3001';

async function testClientCreation() {
    console.log('=== Client Creation Test Suite ===\n');

    const testUserId = `test-user-${Date.now()}`;
    const testClientName = `Test Client ${Date.now()}`;
    let createdDsoId = null;

    try {
        // Test 1: Create a new client via API
        console.log('Test 1: Creating new client via POST /api/dsos');
        console.log(`  User ID: ${testUserId}`);
        console.log(`  Client Name: ${testClientName}`);

        const createResponse = await fetch(`${LOCAL_API_URL}/api/dsos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: testClientName,
                user_id: testUserId
            }),
        });

        const createData = await createResponse.json();

        if (!createResponse.ok) {
            console.log(`  FAILED: ${createData.error}`);
            throw new Error(`Create failed: ${createData.error}`);
        }

        createdDsoId = createData.dso?.id;
        console.log(`  SUCCESS: Created DSO with ID ${createdDsoId}\n`);

        // Test 2: Verify the client appears in GET /api/dsos for this user
        console.log('Test 2: Fetching clients for user via GET /api/dsos');

        const listResponse = await fetch(`${LOCAL_API_URL}/api/dsos?user_id=${testUserId}`);
        const listData = await listResponse.json();

        if (!listResponse.ok) {
            console.log(`  FAILED: ${listData.error}`);
            throw new Error(`List failed: ${listData.error}`);
        }

        const foundClient = listData.dsos?.find(d => d.id === createdDsoId);

        if (!foundClient) {
            console.log(`  FAILED: Created client NOT found in user's client list`);
            console.log(`  Available clients: ${JSON.stringify(listData.dsos?.map(d => d.id))}`);
            throw new Error('Client not found in list - THIS IS THE BUG');
        }

        console.log(`  SUCCESS: Client found in user's list`);
        console.log(`  Client details: ${JSON.stringify(foundClient)}\n`);

        // Test 3: Verify user_dso_access record exists
        console.log('Test 3: Verifying user_dso_access record exists');

        const accessCheckResponse = await fetch(`${SUPABASE_URL}/rest/v1/user_dso_access?user_id=eq.${testUserId}&dso_id=eq.${createdDsoId}`, {
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            },
        });

        const accessData = await accessCheckResponse.json();

        if (!accessData || accessData.length === 0) {
            console.log(`  FAILED: No user_dso_access record found`);
            throw new Error('Access record missing - user will see "Client not found"');
        }

        console.log(`  SUCCESS: Access record exists with role: ${accessData[0].role}\n`);

        console.log('=== ALL TESTS PASSED ===\n');

    } catch (error) {
        console.error(`\nTEST FAILED: ${error.message}\n`);
    } finally {
        // Cleanup: Delete test data
        if (createdDsoId) {
            console.log('Cleanup: Deleting test data...');

            // Delete access record first (due to foreign key)
            await fetch(`${SUPABASE_URL}/rest/v1/user_dso_access?dso_id=eq.${createdDsoId}`, {
                method: 'DELETE',
                headers: {
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                },
            });

            // Delete DSO
            await fetch(`${SUPABASE_URL}/rest/v1/dsos?id=eq.${createdDsoId}`, {
                method: 'DELETE',
                headers: {
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                },
            });

            console.log('Cleanup complete.\n');
        }
    }
}

// Run the test
testClientCreation();
