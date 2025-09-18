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
            { title: `${query} - Essential Guide`, desc: `Comprehensive resource for ${query}`, url: `https://example.com/${query.replace(/\s+/g, '-').toLowerCase()}-guide`, author: "Unknown Author" },
            { title: `Mastering ${query}`, desc: `Advanced techniques and strategies`, url: `https://example.com/mastering-${query.replace(/\s+/g, '-').toLowerCase()}`, author: "Expert Author" },
            { title: `${query} for Beginners`, desc: `Perfect starting point for newcomers`, url: `https://example.com/${query.replace(/\s+/g, '-').toLowerCase()}-beginners`, author: "Beginner Guide" }
          ],
          podcasts: [
            { title: `${query} Podcast`, desc: `Weekly insights and discussions`, url: `https://example.com/${query.replace(/\s+/g, '-').toLowerCase()}-podcast` },
            { title: `The ${query} Show`, desc: `Expert interviews and tips`, url: `https://example.com/${query.replace(/\s+/g, '-').toLowerCase()}-show` }
          ],
          social: [
            { title: `${query} Twitter`, desc: `Best accounts and communities`, url: `https://example.com/${query.replace(/\s+/g, '-').toLowerCase()}-twitter` },
            { title: `${query} YouTube`, desc: `Top channels and tutorials`, url: `https://example.com/${query.replace(/\s+/g, '-').toLowerCase()}-youtube` }
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
- An author field for books (this helps with cover image lookup)

Make the recommendations relevant, specific, and actually useful for someone learning about "${query}". Use real book titles, podcast names, and social media accounts when possible.

Return your response as a JSON object with this exact structure:
{
  "books": [
    {"title": "Book Title", "desc": "Description", "url": "https://example.com/book-url", "author": "Author Name"}
  ],
  "podcasts": [
    {"title": "Podcast Name", "desc": "Description", "url": "https://example.com/podcast-url"}
  ],
  "social": [
    {"title": "Account/Channel Name", "desc": "Description", "url": "https://example.com/social-url"}
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
            { title: `${query} - Essential Guide`, desc: `Comprehensive resource for ${query}`, url: `https://example.com/${query.replace(/\s+/g, '-').toLowerCase()}-guide`, author: "Unknown Author" },
            { title: `Mastering ${query}`, desc: `Advanced techniques and strategies`, url: `https://example.com/mastering-${query.replace(/\s+/g, '-').toLowerCase()}`, author: "Expert Author" },
            { title: `${query} for Beginners`, desc: `Perfect starting point for newcomers`, url: `https://example.com/${query.replace(/\s+/g, '-').toLowerCase()}-beginners`, author: "Beginner Guide" }
          ],
          podcasts: [
            { title: `${query} Podcast`, desc: `Weekly insights and discussions`, url: `https://example.com/${query.replace(/\s+/g, '-').toLowerCase()}-podcast` },
            { title: `The ${query} Show`, desc: `Expert interviews and tips`, url: `https://example.com/${query.replace(/\s+/g, '-').toLowerCase()}-show` }
          ],
          social: [
            { title: `${query} Twitter`, desc: `Best accounts and communities`, url: `https://example.com/${query.replace(/\s+/g, '-').toLowerCase()}-twitter` },
            { title: `${query} YouTube`, desc: `Top channels and tutorials`, url: `https://example.com/${query.replace(/\s+/g, '-').toLowerCase()}-youtube` }
          ]
        };
      }

      // Fetch real cover images for each resource
      const fetchCoverImage = async (resource, type) => {
        try {
          const coverResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/ai/cover-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: resource.title,
              type: type,
              author: resource.author
            })
          });
          
          if (coverResponse.ok) {
            const coverData = await coverResponse.json();
            return coverData.imageUrl;
          }
        } catch (error) {
          console.log(`Failed to fetch cover for ${resource.title}:`, error.message);
        }
        return null;
      };

      // Add thumbnails to all resources
      if (resources.books) {
        for (const book of resources.books) {
          book.thumbnail = await fetchCoverImage(book, 'book');
        }
      }
      
      if (resources.podcasts) {
        for (const podcast of resources.podcasts) {
          podcast.thumbnail = await fetchCoverImage(podcast, 'podcast');
        }
      }
      
      if (resources.social) {
        for (const social of resources.social) {
          social.thumbnail = await fetchCoverImage(social, 'social');
        }
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
          { title: `${query} - Essential Guide`, desc: `Comprehensive resource for ${query}`, url: `https://example.com/${query.replace(/\s+/g, '-').toLowerCase()}-guide`, author: "Unknown Author" },
          { title: `Mastering ${query}`, desc: `Advanced techniques and strategies`, url: `https://example.com/mastering-${query.replace(/\s+/g, '-').toLowerCase()}`, author: "Expert Author" },
          { title: `${query} for Beginners`, desc: `Perfect starting point for newcomers`, url: `https://example.com/${query.replace(/\s+/g, '-').toLowerCase()}-beginners`, author: "Beginner Guide" }
        ],
        podcasts: [
          { title: `${query} Podcast`, desc: `Weekly insights and discussions`, url: `https://example.com/${query.replace(/\s+/g, '-').toLowerCase()}-podcast` },
          { title: `The ${query} Show`, desc: `Expert interviews and tips`, url: `https://example.com/${query.replace(/\s+/g, '-').toLowerCase()}-show` }
        ],
        social: [
          { title: `${query} Twitter`, desc: `Best accounts and communities`, url: `https://example.com/${query.replace(/\s+/g, '-').toLowerCase()}-twitter` },
          { title: `${query} YouTube`, desc: `Top channels and tutorials`, url: `https://example.com/${query.replace(/\s+/g, '-').toLowerCase()}-youtube` }
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
        { title: `${query || 'Your Topic'} - Essential Guide`, desc: `Comprehensive resource for ${query || 'your topic'}`, url: `https://example.com/guide`, author: "Unknown Author" },
        { title: `Mastering ${query || 'Your Topic'}`, desc: `Advanced techniques and strategies`, url: `https://example.com/mastering`, author: "Expert Author" },
        { title: `${query || 'Your Topic'} for Beginners`, desc: `Perfect starting point for newcomers`, url: `https://example.com/beginners`, author: "Beginner Guide" }
      ],
      podcasts: [
        { title: `${query || 'Your Topic'} Podcast`, desc: `Weekly insights and discussions`, url: `https://example.com/podcast` },
        { title: `The ${query || 'Your Topic'} Show`, desc: `Expert interviews and tips`, url: `https://example.com/show` }
      ],
      social: [
        { title: `${query || 'Your Topic'} Twitter`, desc: `Best accounts and communities`, url: `https://example.com/twitter` },
        { title: `${query || 'Your Topic'} YouTube`, desc: `Top channels and tutorials`, url: `https://example.com/youtube` }
      ]
    };

    return NextResponse.json({ 
      query: query || 'Your Topic',
      ...fallbackResources,
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    });
  }
}
