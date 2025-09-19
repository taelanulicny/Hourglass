import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request) {
  try {
    console.log('AI Resources API called');
    
    // Check environment variables
    const hasApiKey = !!process.env.OPENAI_API_KEY;
    
    if (!hasApiKey) {
      console.error('OpenAI API key not configured');
      return NextResponse.json(
        { 
          error: 'OpenAI API key not configured'
        },
        { status: 500 }
      );
    }

    // Parse request body
    let query;
    try {
      const body = await request.json();
      query = body.query;
      console.log('Resource search query:', query);
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Create a system message for resource recommendations
  const systemMessage = {
    role: 'system',
    content: `Find 5 books, 5 people, 5 podcasts for any topic. Return JSON only:

CRITICAL: NEVER use "Twitter" - ALWAYS use "X" for the social media platform. NEVER use twitter.com URLs - ALWAYS use x.com URLs.

{
  "books": [{"title": "Book", "desc": "Description", "url": "https://amazon.com/dp/123", "author": "Author"}],
  "podcasts": [{"title": "Podcast", "desc": "Description", "url": "https://podcasts.apple.com/podcast/123", "spotifyUrl": "https://open.spotify.com/show/123"}],
  "social": [{"name": "Person", "desc": "What they do", "socialLinks": [{"platform": "X", "handle": "@handle", "url": "https://x.com/handle", "icon": "X"}]}]
}`
  };

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          systemMessage,
          {
            role: 'user',
            content: `${query}`
          }
        ],
        max_tokens: 2500,
        temperature: 0.3,
      });

      const response = completion.choices[0]?.message?.content || '';
      
      // Try to parse the JSON response
      let resources;
      try {
        // Clean up the response first
        let cleanedResponse = response.trim();
        
        // Remove any markdown code blocks if present
        cleanedResponse = cleanedResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        
        // Extract JSON from the response (in case there's extra text)
        const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          let jsonString = jsonMatch[0];
          
          // Handle truncated responses by finding the last complete JSON structure
          let lastCompleteIndex = -1;
          let braceCount = 0;
          let bracketCount = 0;
          
          // Walk through the string to find the last complete object
          for (let i = 0; i < jsonString.length; i++) {
            if (jsonString[i] === '{') braceCount++;
            if (jsonString[i] === '}') braceCount--;
            if (jsonString[i] === '[') bracketCount++;
            if (jsonString[i] === ']') bracketCount--;
            
            // If we're back to balanced braces and brackets, this is a complete structure
            if (braceCount === 0 && bracketCount === 0) {
              lastCompleteIndex = i;
            }
          }
          
          if (lastCompleteIndex > 0) {
            jsonString = jsonString.substring(0, lastCompleteIndex + 1);
          }
          
          // Fix incomplete arrays/objects by removing trailing commas and incomplete elements
          jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');
          
          // Remove any incomplete object properties at the end
          jsonString = jsonString.replace(/,\s*"platform":\s*$/, '');
          jsonString = jsonString.replace(/,\s*"[^"]*":\s*$/, '');
          jsonString = jsonString.replace(/,\s*"[^"]*":\s*"[^"]*$/, '');
          
          // Fix incomplete social media entries
          jsonString = jsonString.replace(/,\s*\{[^}]*$/, '');
          jsonString = jsonString.replace(/,\s*\{[^}]*,\s*"[^"]*":\s*$/, '');
          
          // Remove any incomplete entries at the end of arrays
          jsonString = jsonString.replace(/,\s*\{[^}]*,\s*"[^"]*":\s*"[^"]*$/, '');
          
          // Fix truncated strings in social links
          jsonString = jsonString.replace(/,\s*"socialLinks":\s*\[[^\]]*,\s*\{[^}]*$/, '');
          
          // Ensure arrays are properly closed
          jsonString = jsonString.replace(/,\s*\[[^\]]*$/, '');
          jsonString = jsonString.replace(/,\s*\{[^}]*$/, '');
          
          // Remove any trailing incomplete objects
          jsonString = jsonString.replace(/,\s*\{[^}]*,\s*"[^"]*":\s*$/, '');
          
          // Ensure the JSON ends properly with closing braces
          const openBraces = (jsonString.match(/\{/g) || []).length;
          const closeBraces = (jsonString.match(/\}/g) || []).length;
          const openBrackets = (jsonString.match(/\[/g) || []).length;
          const closeBrackets = (jsonString.match(/\]/g) || []).length;
          
          // Add missing closing brackets
          for (let i = 0; i < openBrackets - closeBrackets; i++) {
            jsonString += ']';
          }
          
          // Add missing closing braces
          for (let i = 0; i < openBraces - closeBraces; i++) {
            jsonString += '}';
          }
          
          resources = JSON.parse(jsonString);
          
          // Validate that we have the required structure
          if (!resources.books || !resources.podcasts || !resources.social) {
            throw new Error('Missing required sections in AI response');
          }
          
          // Ensure we have at least some items in each category (be more flexible)
          if (resources.books.length === 0 && resources.podcasts.length === 0 && resources.social.length === 0) {
            throw new Error('AI response contains no resources');
          }
          
          // Fill in empty arrays with at least one item if needed
          if (resources.books.length === 0) {
            resources.books = [{"title": `${query} - Essential Guide`, "desc": `Comprehensive resource for ${query}`, "url": `https://amazon.com/dp/123456789`, "author": "Expert Author"}];
          }
          if (resources.podcasts.length === 0) {
            resources.podcasts = [{"title": `${query} Podcast`, "desc": `Learn about ${query}`, "url": `https://podcasts.apple.com/podcast/123456789`, "spotifyUrl": `https://open.spotify.com/show/123456789`}];
          }
          if (resources.social.length === 0) {
            resources.social = [{"name": `${query} Expert`, "desc": `Leading expert in ${query}`, "socialLinks": [{"platform": "X", "handle": `@${query.toLowerCase()}expert`, "url": `https://x.com/${query.toLowerCase()}expert`, "icon": "X"}]}];
          }
          
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        console.error('Failed to parse AI response as JSON:', parseError);
        console.log('Raw AI response:', response);
        
        // If JSON parsing fails, return an error instead of fallback resources
        return NextResponse.json(
          { 
            error: 'AI response could not be parsed. Please try again.',
            query: query
          },
          { status: 500 }
        );
      }

      // Image fetching has been removed - resources are now text-only

      return NextResponse.json({ 
        query: query,
        ...resources,
        usage: completion.usage 
      });
    } catch (openaiError) {
      console.error('OpenAI API error:', openaiError);
      
      return NextResponse.json(
        { 
          error: 'OpenAI API error. Please try again.',
          query: query
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('General API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error. Please try again.',
        query: query || 'Your Topic'
      },
      { status: 500 }
    );
  }
}
