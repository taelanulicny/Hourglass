import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function GET() {
  try {
    console.log('Testing OpenAI API...');
    
    // Check environment variables
    const hasApiKey = !!process.env.OPENAI_API_KEY;
    const keyLength = process.env.OPENAI_API_KEY?.length || 0;
    
    console.log('Environment check:', {
      hasOpenAIKey: hasApiKey,
      keyLength: keyLength,
      nodeEnv: process.env.NODE_ENV
    });

    if (!hasApiKey) {
      return NextResponse.json({
        error: 'No API key found',
        hasApiKey,
        keyLength
      });
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Try a very simple test call
    console.log('Attempting OpenAI API call...');
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'user',
          content: 'Hello, this is a test message. Please respond with "Test successful!"'
        }
      ],
      max_tokens: 10,
      temperature: 0.1,
    });

    const response = completion.choices[0]?.message?.content || 'No response';

    return NextResponse.json({
      success: true,
      response: response,
      usage: completion.usage,
      model: completion.model
    });

  } catch (error) {
    console.error('OpenAI API test error:', error);
    
    return NextResponse.json({
      error: 'OpenAI API test failed',
      details: error.message,
      errorType: error.constructor.name,
      status: error.status,
      code: error.code,
      type: error.type
    }, { status: 500 });
  }
}
