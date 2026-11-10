import { getApiBase } from "./auth";
export async function generateStory({
  title,
  prompt,
  genre,
  contentRating,
}: {
  title: string;
  prompt: string;
  genre: string;
  contentRating: string;
}) {
  const response = await fetch(
    `${getApiBase()}/api/stories/generate`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({
        title,
        prompt,
        genre,
        contentRating,
      }),
    }
  );

  if (!response.ok) {
    throw new Error('Failed to generate story');
  }

  return response.json();
}

export async function generateVideoFromScene(sceneId: string, imageUrl: string, prompt: string) {
  const response = await fetch(`${getApiBase()}/api/videos/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token')}`,
    },
    body: JSON.stringify({
      sceneId,
      imageUrl,
      prompt,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to generate video');
  }

  return response.json();
}

export async function enhanceStory({
  storyId,
  aspect,
}: {
  storyId: string;
  aspect: string;
}) {
  const response = await fetch(`${getApiBase()}/api/creative/enhance`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token')}`,
    },
    body: JSON.stringify({
      storyId,
      aspect,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to enhance story');
  }

  return response.json();
}
