import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request) {
  try {
    console.log('AI Chat API called');
    console.log('Environment check:', {
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      keyLength: process.env.OPENAI_API_KEY?.length || 0,
      nodeEnv: process.env.NODE_ENV
    });

    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key not configured');
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const { messages, focusContext } = await request.json();
    console.log('Request data:', { messagesCount: messages?.length, focusContext });

    // Create a system message that includes focus area context
    const systemMessage = {
      role: 'system',
      content: `You are a helpful AI assistant specialized in providing advice and support for the focus area "${focusContext?.name || 'this area'}". 

Context about this focus area:
- Name: ${focusContext?.name || 'Unknown'}
- Daily Goal: ${focusContext?.goal || 'Not set'} hours
- Time logged this week: ${focusContext?.weekLogged || 0} hours
- Time left today: ${focusContext?.leftToday || 0} hours

Provide personalized, actionable advice related to this focus area. Be encouraging, specific, and helpful. If the user asks about time management, productivity, or goal achievement, provide practical tips tailored to their specific focus area and current progress.`
    };

    // Add the system message at the beginning
    const allMessages = [systemMessage, ...messages];

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: allMessages,
      max_tokens: 500,
      temperature: 0.7,
    });

    const response = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

    return NextResponse.json({ 
      message: response,
      usage: completion.usage 
    });

  } catch (error) {
    console.error('OpenAI API error:', error);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    return NextResponse.json(
      { 
        error: 'Failed to get AI response',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
