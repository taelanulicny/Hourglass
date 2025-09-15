import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request) {
  try {
    console.log('AI Chat API called');
    
    // Check environment variables
    const hasApiKey = !!process.env.OPENAI_API_KEY;
    const keyLength = process.env.OPENAI_API_KEY?.length || 0;
    
    console.log('Environment check:', {
      hasOpenAIKey: hasApiKey,
      keyLength: keyLength,
      nodeEnv: process.env.NODE_ENV
    });

    if (!hasApiKey) {
      console.error('OpenAI API key not configured');
      return NextResponse.json(
        { 
          error: 'OpenAI API key not configured',
          debug: {
            hasApiKey,
            keyLength,
            nodeEnv: process.env.NODE_ENV
          }
        },
        { status: 500 }
      );
    }

    // Parse request body
    let messages, focusContext;
    try {
      const body = await request.json();
      messages = body.messages;
      focusContext = body.focusContext;
      console.log('Request data:', { messagesCount: messages?.length, focusContext });
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

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

    try {
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
    } catch (openaiError) {
      console.error('OpenAI API error:', openaiError);
      
      // If it's a quota error, provide a helpful fallback response
      if (openaiError.status === 429) {
        const userMessage = messages[messages.length - 1]?.content || "your question";
        const focusArea = focusContext?.name || 'your focus area';
        const dailyGoal = focusContext?.goal || 'not set';
        
        let contextualTips = "";
        
        // Provide contextual tips based on focus area
        if (focusArea.toLowerCase().includes('school') || focusArea.toLowerCase().includes('study')) {
          contextualTips = `Here are some study-focused tips for "${focusArea}":

1. **Break down your goal**: Use the Pomodoro technique - 25 minutes focused study, 5 minute break.
2. **Use active recall**: Instead of just reading, test yourself on the material.
3. **Create a study schedule**: Plan specific times for different subjects.
4. **Find a study buddy**: Accountability can help you stay on track.`;
        } else if (focusArea.toLowerCase().includes('reserve') || focusArea.toLowerCase().includes('business')) {
          contextualTips = `Here are some business-focused tips for "${focusArea}":

1. **Time-block your meetings**: Schedule manufacturer calls in focused 2-hour blocks.
2. **Prepare an agenda**: List key topics and questions before each call.
3. **Follow up systematically**: Take notes and send summaries after each meeting.
4. **Batch similar tasks**: Group all manufacturer communications together.`;
        } else if (focusArea.toLowerCase().includes('exercise') || focusArea.toLowerCase().includes('fitness')) {
          contextualTips = `Here are some fitness-focused tips for "${focusArea}":

1. **Schedule your workouts**: Block out specific times in your calendar.
2. **Start small**: Begin with shorter sessions and build up gradually.
3. **Track your progress**: Monitor your daily goal of ${dailyGoal} hours.
4. **Find an accountability partner**: Work out with a friend or use a fitness app.`;
        } else {
          contextualTips = `Here are some general productivity tips for "${focusArea}":

1. **Set specific goals**: Break down your ${dailyGoal}-hour daily goal into manageable chunks.
2. **Use time-blocking**: Schedule focused work sessions without distractions.
3. **Track your progress**: Monitor how much time you've logged this week.
4. **Take breaks**: Regular breaks help maintain focus and prevent burnout.`;
        }
        
        const fallbackResponse = `I can see you're asking about "${userMessage}" for your focus area "${focusArea}" with a daily goal of ${dailyGoal} hours. 

I'm currently experiencing a quota issue with my AI service, but I can still help you! ${contextualTips}

Would you like me to help you create a specific plan for your focus area?`;

        return NextResponse.json({ 
          message: fallbackResponse,
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
        });
      }
      
      throw openaiError;
    }

  } catch (error) {
    console.error('General API error:', error);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    
    // Provide a helpful fallback even for general errors
    const fallbackResponse = `I'm having trouble connecting to my AI service right now, but I can still help you with your focus area "${focusContext?.name || 'your goal'}"!

Here are some quick tips:
- Set specific, achievable goals
- Use time-blocking to focus on one task at a time
- Take regular breaks to maintain focus
- Track your progress to stay motivated

Try asking me again in a moment, or let me know what specific help you need!`;

    return NextResponse.json({ 
      message: fallbackResponse,
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    });
  }
}
