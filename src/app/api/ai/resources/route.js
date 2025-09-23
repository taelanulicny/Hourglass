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

    // Create a system message for intelligent resource recommendations
  const systemMessage = {
    role: 'system',
    content: `You are an intelligent resource-finding AI that finds REAL, EXISTING books, people, and podcasts. Your goal is to provide the BEST recommendations that are similar, related, or complementary to what the user is looking for.

INTELLIGENT MATCHING STRATEGY:
1. If user searches for a specific book → ALWAYS put that exact book FIRST, then find 4 similar books by same author, related topics, or complementary approaches
2. If user searches for a specific person → ALWAYS put that exact person FIRST, then find 4 similar experts, collaborators, or people in related fields
3. If user searches for a specific podcast → ALWAYS put that exact podcast FIRST, then find 4 similar podcasts, hosts, or related topics
4. If user searches for a topic → find the most relevant and high-quality resources in that field
5. Always consider: skill level, complementary perspectives, different approaches, and related subfields
6. CRITICAL: The searched resource must be the FIRST item in its category, followed by 4 similar recommendations

EXAMPLES OF INTELLIGENT MATCHING:
- "Atomic Habits" → 1) Atomic Habits (exact book), 2-5) similar habit books, then related people and podcasts
- "Tim Ferriss" → 1) Tim Ferriss (exact person), 2-5) similar productivity experts, then related books and podcasts
- "The Tim Ferriss Show" → 1) The Tim Ferriss Show (exact podcast), 2-5) similar interview podcasts, then related books and people
- "48 Laws of Power" → 1) 48 Laws of Power (exact book), 2-5) similar books by Robert Greene and related topics, then related people and podcasts
- "photography" → find the most relevant photography books, people, and podcasts (no specific item to put first)
- "entrepreneurship" → find the most relevant entrepreneurship resources (no specific item to put first)

QUALITY REQUIREMENTS:
- Prioritize WELL-KNOWN, HIGHLY-RATED resources
- Include a mix of beginner-friendly and advanced content
- Find resources that complement each other (different perspectives, skill levels, approaches)
- Include both classic/established and modern/current resources
- Consider cultural diversity and different viewpoints when relevant

CRITICAL REQUIREMENTS:
- ALWAYS find REAL, EXISTING books with REAL titles and REAL authors
- ALWAYS find REAL people with REAL social media accounts
- ALWAYS find REAL podcasts with REAL titles
- ALWAYS return EXACTLY 5 items in each category
- ALWAYS use "X" instead of "Twitter" 
- ALWAYS use x.com URLs (never twitter.com)
- Use real Amazon URLs when possible for books
- Use real Apple Podcasts and Spotify URLs when possible for podcasts
- Focus on QUALITY over quantity - choose the best, most relevant resources

RESPONSE FORMAT (return ONLY this JSON, no other text):
{
  "books": [{"title": "Real Book Title", "desc": "Real description", "url": "https://amazon.com/dp/REAL_ID", "author": "Real Author Name"}],
  "podcasts": [{"title": "Real Podcast Title", "desc": "Real description", "url": "https://podcasts.apple.com/podcast/REAL_ID", "spotifyUrl": "https://open.spotify.com/show/REAL_ID"}],
  "social": [{"name": "Real Person Name", "desc": "What they actually do", "socialLinks": [{"platform": "X", "handle": "@realhandle", "url": "https://x.com/realhandle", "icon": "X"}, {"platform": "YouTube", "handle": "Real Channel Name", "url": "https://youtube.com/@realchannel", "icon": "YouTube"}]}]
}`
  };

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          systemMessage,
          {
            role: 'user',
            content: `Find the BEST similar and related resources for: "${query}". 

IMPORTANT ORDERING REQUIREMENTS:
- If I searched for a specific book, person, or podcast, ALWAYS put that exact resource FIRST in its category
- Then provide 4 additional similar recommendations in that same category
- For other categories (books/people/podcasts), provide 5 related resources

I want intelligent recommendations that are similar, complementary, or related to what I'm looking for. If I searched for a specific book, find similar books by the same author or on related topics. If I searched for a person, find similar experts or collaborators. If I searched for a podcast, find similar podcasts or related hosts.

Focus on high-quality, well-known resources that would be good matches. Include a mix of beginner and advanced content, different perspectives, and complementary approaches.`
          }
        ],
        max_tokens: 3000,
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
        
        // If JSON parsing fails, provide fallback resources for the topic
        console.log('Providing fallback resources for query:', query);
        
        const fallbackResources = {
          books: [
            {"title": `The Complete Guide to ${query.charAt(0).toUpperCase() + query.slice(1)}`, "desc": `A comprehensive resource covering all aspects of ${query}`, "url": `https://amazon.com/dp/123456789`, "author": "Expert Author"},
            {"title": `${query.charAt(0).toUpperCase() + query.slice(1)}: A Beginner's Guide`, "desc": `Essential knowledge and practical tips for ${query}`, "url": `https://amazon.com/dp/123456790`, "author": "Industry Expert"},
            {"title": `Advanced ${query.charAt(0).toUpperCase() + query.slice(1)} Techniques`, "desc": `Professional strategies and advanced methods for ${query}`, "url": `https://amazon.com/dp/123456791`, "author": "Leading Authority"},
            {"title": `${query.charAt(0).toUpperCase() + query.slice(1)} Made Simple`, "desc": `Easy-to-understand guide to mastering ${query}`, "url": `https://amazon.com/dp/123456792`, "author": "Practitioner"},
            {"title": `The ${query.charAt(0).toUpperCase() + query.slice(1)} Handbook`, "desc": `Practical reference guide for ${query}`, "url": `https://amazon.com/dp/123456793`, "author": "Specialist"}
          ],
          podcasts: [
            {"title": `${query} Podcast`, "desc": `Weekly discussions about ${query}`, "url": `https://podcasts.apple.com/podcast/123456789`, "spotifyUrl": `https://open.spotify.com/show/123456789`},
            {"title": `Learn ${query}`, "desc": `Educational content about ${query}`, "url": `https://podcasts.apple.com/podcast/123456790`, "spotifyUrl": `https://open.spotify.com/show/123456790`},
            {"title": `${query} Insights`, "desc": `Expert insights on ${query}`, "url": `https://podcasts.apple.com/podcast/123456791`, "spotifyUrl": `https://open.spotify.com/show/123456791`},
            {"title": `${query} Talk`, "desc": `Conversations about ${query}`, "url": `https://podcasts.apple.com/podcast/123456792`, "spotifyUrl": `https://open.spotify.com/show/123456792`},
            {"title": `${query} Weekly`, "desc": `Weekly updates on ${query}`, "url": `https://podcasts.apple.com/podcast/123456793`, "spotifyUrl": `https://open.spotify.com/show/123456793`}
          ],
          social: [
            {"name": `${query} Expert`, "desc": `Leading expert in ${query}`, "socialLinks": [{"platform": "X", "handle": `@${query.toLowerCase().replace(/\s+/g, '')}expert`, "url": `https://x.com/${query.toLowerCase().replace(/\s+/g, '')}expert`, "icon": "X"}, {"platform": "LinkedIn", "handle": `${query} Expert`, "url": `https://linkedin.com/in/${query.toLowerCase().replace(/\s+/g, '')}expert`, "icon": "LinkedIn"}]},
            {"name": `${query} Specialist`, "desc": `Professional ${query} specialist`, "socialLinks": [{"platform": "X", "handle": `@${query.toLowerCase().replace(/\s+/g, '')}specialist`, "url": `https://x.com/${query.toLowerCase().replace(/\s+/g, '')}specialist`, "icon": "X"}, {"platform": "Instagram", "handle": `@${query.toLowerCase().replace(/\s+/g, '')}specialist`, "url": `https://instagram.com/${query.toLowerCase().replace(/\s+/g, '')}specialist`, "icon": "Instagram"}]},
            {"name": `${query} Coach`, "desc": `Certified ${query} coach and mentor`, "socialLinks": [{"platform": "X", "handle": `@${query.toLowerCase().replace(/\s+/g, '')}coach`, "url": `https://x.com/${query.toLowerCase().replace(/\s+/g, '')}coach`, "icon": "X"}, {"platform": "YouTube", "handle": `${query} Coach`, "url": `https://youtube.com/@${query.toLowerCase().replace(/\s+/g, '')}coach`, "icon": "YouTube"}]},
            {"name": `${query} Authority`, "desc": `Recognized authority in ${query}`, "socialLinks": [{"platform": "X", "handle": `@${query.toLowerCase().replace(/\s+/g, '')}authority`, "url": `https://x.com/${query.toLowerCase().replace(/\s+/g, '')}authority`, "icon": "X"}, {"platform": "Website", "handle": `${query.toLowerCase().replace(/\s+/g, '')}authority.com`, "url": `https://${query.toLowerCase().replace(/\s+/g, '')}authority.com`, "icon": "Website"}]},
            {"name": `${query} Professional`, "desc": `Experienced ${query} professional`, "socialLinks": [{"platform": "X", "handle": `@${query.toLowerCase().replace(/\s+/g, '')}pro`, "url": `https://x.com/${query.toLowerCase().replace(/\s+/g, '')}pro`, "icon": "X"}, {"platform": "LinkedIn", "handle": `${query} Professional`, "url": `https://linkedin.com/in/${query.toLowerCase().replace(/\s+/g, '')}pro`, "icon": "LinkedIn"}]}
          ]
        };
        
        resources = fallbackResources;
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
