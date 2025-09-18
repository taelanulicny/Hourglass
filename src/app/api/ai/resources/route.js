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
          error: 'OpenAI API key not configured',
        fallback: {
          books: [
            { title: `${query} - Essential Guide`, desc: `Comprehensive resource for ${query}`, url: `https://example.com/${query.replace(/\s+/g, '-').toLowerCase()}-guide`, thumbnail: `https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=200&h=200&fit=crop` },
            { title: `Mastering ${query}`, desc: `Advanced techniques and strategies`, url: `https://example.com/mastering-${query.replace(/\s+/g, '-').toLowerCase()}`, thumbnail: `https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=200&h=200&fit=crop` },
            { title: `${query} for Beginners`, desc: `Perfect starting point for newcomers`, url: `https://example.com/${query.replace(/\s+/g, '-').toLowerCase()}-beginners`, thumbnail: `https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop` }
          ],
          podcasts: [
            { title: `${query} Podcast`, desc: `Weekly insights and discussions`, url: `https://example.com/${query.replace(/\s+/g, '-').toLowerCase()}-podcast`, thumbnail: `https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=200&h=200&fit=crop` },
            { title: `The ${query} Show`, desc: `Expert interviews and tips`, url: `https://example.com/${query.replace(/\s+/g, '-').toLowerCase()}-show`, thumbnail: `https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=200&h=200&fit=crop` }
          ],
          social: [
            { title: `${query} Twitter`, desc: `Best accounts and communities`, url: `https://example.com/${query.replace(/\s+/g, '-').toLowerCase()}-twitter`, thumbnail: `https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=200&h=200&fit=crop` },
            { title: `${query} YouTube`, desc: `Top channels and tutorials`, url: `https://example.com/${query.replace(/\s+/g, '-').toLowerCase()}-youtube`, thumbnail: `https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=200&h=200&fit=crop` }
          ]
        }
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
      content: `You are a helpful AI assistant that finds high-quality resources for learning topics. When given a topic like "${query}", you should recommend:

1. **Books** - 3-5 specific, well-known books with real titles and authors
2. **Social Media** - 3-4 specific Twitter accounts, YouTube channels, or LinkedIn profiles
3. **Podcasts** - 3-4 specific podcast shows or episodes

For each resource, provide:
- A realistic, specific title
- A brief, helpful description
- A placeholder URL (use example.com format)
- A thumbnail URL (use placeholder images from unsplash.com or similar)

Make the recommendations relevant, specific, and actually useful for someone learning about "${query}". Use real book titles, podcast names, and social media accounts when possible.

Return your response as a JSON object with this exact structure:
{
  "books": [
    {"title": "Book Title", "desc": "Description", "url": "https://example.com/book-url", "thumbnail": "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=200&h=200&fit=crop"}
  ],
  "podcasts": [
    {"title": "Podcast Name", "desc": "Description", "url": "https://example.com/podcast-url", "thumbnail": "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=200&h=200&fit=crop"}
  ],
  "social": [
    {"title": "Account/Channel Name", "desc": "Description", "url": "https://example.com/social-url", "thumbnail": "https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=200&h=200&fit=crop"}
  ]
}`
    };

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          systemMessage,
          {
            role: 'user',
            content: `Find resources for learning about: ${query}`
          }
        ],
        max_tokens: 1000,
        temperature: 0.7,
      });

      const response = completion.choices[0]?.message?.content || '';
      
      // Try to parse the JSON response
      let resources;
      try {
        // Extract JSON from the response (in case there's extra text)
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          resources = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        console.error('Failed to parse AI response as JSON:', parseError);
        console.log('Raw AI response:', response);
        
        // Fallback to generated resources
        resources = {
          books: [
            { title: `${query} - Essential Guide`, desc: `Comprehensive resource for ${query}`, url: `https://example.com/${query.replace(/\s+/g, '-').toLowerCase()}-guide`, thumbnail: `https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=200&h=200&fit=crop` },
            { title: `Mastering ${query}`, desc: `Advanced techniques and strategies`, url: `https://example.com/mastering-${query.replace(/\s+/g, '-').toLowerCase()}`, thumbnail: `https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=200&h=200&fit=crop` },
            { title: `${query} for Beginners`, desc: `Perfect starting point for newcomers`, url: `https://example.com/${query.replace(/\s+/g, '-').toLowerCase()}-beginners`, thumbnail: `https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop` }
          ],
          podcasts: [
            { title: `${query} Podcast`, desc: `Weekly insights and discussions`, url: `https://example.com/${query.replace(/\s+/g, '-').toLowerCase()}-podcast`, thumbnail: `https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=200&h=200&fit=crop` },
            { title: `The ${query} Show`, desc: `Expert interviews and tips`, url: `https://example.com/${query.replace(/\s+/g, '-').toLowerCase()}-show`, thumbnail: `https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=200&h=200&fit=crop` }
          ],
          social: [
            { title: `${query} Twitter`, desc: `Best accounts and communities`, url: `https://example.com/${query.replace(/\s+/g, '-').toLowerCase()}-twitter`, thumbnail: `https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=200&h=200&fit=crop` },
            { title: `${query} YouTube`, desc: `Top channels and tutorials`, url: `https://example.com/${query.replace(/\s+/g, '-').toLowerCase()}-youtube`, thumbnail: `https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=200&h=200&fit=crop` }
          ]
        };
      }

      return NextResponse.json({ 
        query: query,
        ...resources,
        usage: completion.usage 
      });
    } catch (openaiError) {
      console.error('OpenAI API error:', openaiError);
      
      // Fallback response for API errors
      const fallbackResources = {
        books: [
          { title: `${query} - Essential Guide`, desc: `Comprehensive resource for ${query}`, url: `https://example.com/${query.replace(/\s+/g, '-').toLowerCase()}-guide`, thumbnail: `https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=200&h=200&fit=crop` },
          { title: `Mastering ${query}`, desc: `Advanced techniques and strategies`, url: `https://example.com/mastering-${query.replace(/\s+/g, '-').toLowerCase()}`, thumbnail: `https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=200&h=200&fit=crop` },
          { title: `${query} for Beginners`, desc: `Perfect starting point for newcomers`, url: `https://example.com/${query.replace(/\s+/g, '-').toLowerCase()}-beginners`, thumbnail: `https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop` }
        ],
        podcasts: [
          { title: `${query} Podcast`, desc: `Weekly insights and discussions`, url: `https://example.com/${query.replace(/\s+/g, '-').toLowerCase()}-podcast`, thumbnail: `https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=200&h=200&fit=crop` },
          { title: `The ${query} Show`, desc: `Expert interviews and tips`, url: `https://example.com/${query.replace(/\s+/g, '-').toLowerCase()}-show`, thumbnail: `https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=200&h=200&fit=crop` }
        ],
        social: [
          { title: `${query} Twitter`, desc: `Best accounts and communities`, url: `https://example.com/${query.replace(/\s+/g, '-').toLowerCase()}-twitter`, thumbnail: `https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=200&h=200&fit=crop` },
          { title: `${query} YouTube`, desc: `Top channels and tutorials`, url: `https://example.com/${query.replace(/\s+/g, '-').toLowerCase()}-youtube`, thumbnail: `https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=200&h=200&fit=crop` }
        ]
      };

      return NextResponse.json({ 
        query: query,
        ...fallbackResources,
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
      });
    }

  } catch (error) {
    console.error('General API error:', error);
    
    // Provide a helpful fallback even for general errors
    const fallbackResources = {
      books: [
        { title: `${query || 'Your Topic'} - Essential Guide`, desc: `Comprehensive resource for ${query || 'your topic'}`, url: `https://example.com/guide`, thumbnail: `https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=200&h=200&fit=crop` },
        { title: `Mastering ${query || 'Your Topic'}`, desc: `Advanced techniques and strategies`, url: `https://example.com/mastering`, thumbnail: `https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=200&h=200&fit=crop` },
        { title: `${query || 'Your Topic'} for Beginners`, desc: `Perfect starting point for newcomers`, url: `https://example.com/beginners`, thumbnail: `https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop` }
      ],
      podcasts: [
        { title: `${query || 'Your Topic'} Podcast`, desc: `Weekly insights and discussions`, url: `https://example.com/podcast`, thumbnail: `https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=200&h=200&fit=crop` },
        { title: `The ${query || 'Your Topic'} Show`, desc: `Expert interviews and tips`, url: `https://example.com/show`, thumbnail: `https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=200&h=200&fit=crop` }
      ],
      social: [
        { title: `${query || 'Your Topic'} Twitter`, desc: `Best accounts and communities`, url: `https://example.com/twitter`, thumbnail: `https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=200&h=200&fit=crop` },
        { title: `${query || 'Your Topic'} YouTube`, desc: `Top channels and tutorials`, url: `https://example.com/youtube`, thumbnail: `https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=200&h=200&fit=crop` }
      ]
    };

    return NextResponse.json({ 
      query: query || 'Your Topic',
      ...fallbackResources,
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    });
  }
}
