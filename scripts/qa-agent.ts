import { exec } from 'child_process';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

// You might need to load env vars here if not already loaded
// import 'dotenv/config';

interface CommandError {
    command: string;
    stdout: string;
    stderr: string;
    error: Error;
}

const runCommand = (command: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        console.log(`Running: ${command}`);
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error running ${command}`);
                console.log(stdout);
                console.error(stderr);
                const commandError: CommandError = { command, stdout, stderr, error };
                reject(commandError);
                return;
            }
            console.log(`${command} passed.`);
            resolve();
        });
    });
};

const analyzeError = async (step: string, output: string, error: string) => {
    console.log(`\nAnalyzing failure in ${step}...\n`);

    if (!process.env.OPENAI_API_KEY) {
        console.log("OPENAI_API_KEY not found. Skipping AI analysis.");
        return;
    }

    try {
        const prompt = `
      You are a QA expert. A build step failed.
      Step: ${step}
      
      Output:
      ${output}
      
      Error:
      ${error}
      
      Please analyze the error and suggest a fix. Be concise.
    `;

        const { text } = await generateText({
            model: openai('gpt-4o'),
            prompt: prompt,
        });

        console.log('--- AI Analysis ---');
        console.log(text);
        console.log('-------------------\n');
    } catch (e) {
        console.error('Failed to run AI analysis:', e);
    }
};

const main = async () => {
    try {
        // 1. Lint
        try {
            await runCommand('npm run lint');
        } catch (e) {
            const err = e as CommandError;
            await analyzeError('Linting', err.stdout, err.stderr);
            process.exit(1);
        }

        // 2. Unit Tests
        try {
            await runCommand('npm run test -- --run');
        } catch (e) {
            const err = e as CommandError;
            await analyzeError('Unit Tests', err.stdout, err.stderr);
            process.exit(1);
        }

        // 3. E2E Tests
        try {
            await runCommand('npx playwright test');
        } catch (e) {
            const err = e as CommandError;
            await analyzeError('E2E Tests', err.stdout, err.stderr);
            process.exit(1);
        }

        console.log('All QA checks passed!');
    } catch (error) {
        console.error('Unexpected error:', error);
        process.exit(1);
    }
};

main();
