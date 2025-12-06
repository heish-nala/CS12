// AI Chat functionality is currently disabled
// import { openai } from '@ai-sdk/openai';
// import { convertToModelMessages, streamText, UIMessage } from 'ai';

export const maxDuration = 30;

export async function POST(_req: Request) {
    // AI functionality temporarily disabled
    return new Response(
        JSON.stringify({ error: 'AI chat is currently disabled' }),
        {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        }
    );

    // const { messages }: { messages: UIMessage[] } = await req.json();
    //
    // const result = streamText({
    //     model: openai('gpt-4-turbo'),
    //     system: 'You are a helpful customer support agent for Konekt. Be friendly, professional, and concise.',
    //     messages: convertToModelMessages(messages),
    // });
    //
    // return result.toUIMessageStreamResponse();
}
