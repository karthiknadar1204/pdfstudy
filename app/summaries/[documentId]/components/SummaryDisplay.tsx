// Example of how to display the structured overview
const DisplayOverview = ({ content }: { content: string }) => {
  // Check if the content is already in paragraphs
  const paragraphs = content.split('\n\n').filter(p => p.trim());
  
  return (
    <div className="overview-container">
      {paragraphs.map((paragraph, index) => {
        // Apply different styling based on paragraph position
        let className = "overview-paragraph";
        if (index === 0) className += " overview-introduction";
        if (index === paragraphs.length - 1) className += " overview-conclusion";
        
        return (
          <p key={index} className={className}>
            {paragraph}
          </p>
        );
      })}
    </div>
  );
};

// Example of how to display the structured key points
const DisplayKeyPoints = ({ content }: { content: string }) => {
  // Split by newlines to get individual points
  const points = content.split('\n').filter(p => p.trim());
  
  return (
    <div className="key-points-container">
      <ul className="key-points-list">
        {points.map((point, index) => {
          // Extract importance if present
          const importanceMatch = point.match(/\((high|medium|low)\)$/i);
          let importance = "";
          let pointText = point;
          
          if (importanceMatch) {
            importance = importanceMatch[1].toLowerCase();
            pointText = point.replace(/\s*\((?:high|medium|low)\)$/i, '');
          }
          
          return (
            <li 
              key={index} 
              className={`key-point ${importance ? `importance-${importance}` : ''}`}
            >
              {pointText.replace(/^- /, '')}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

// Example of how to display chapter summaries
const DisplayChapterSummary = ({ content, title }: { content: string, title: string }) => {
  // Split by paragraphs
  const paragraphs = content.split('\n\n').filter(p => p.trim());
  
  return (
    <div className="chapter-summary-container">
      <h3 className="chapter-title">{title}</h3>
      <div className="chapter-content">
        {paragraphs.map((paragraph, index) => {
          // Apply different styling based on paragraph position
          let className = "chapter-paragraph";
          if (index === 0) className += " chapter-overview";
          if (index === paragraphs.length - 1) className += " chapter-significance";
          
          return (
            <p key={index} className={className}>
              {paragraph}
            </p>
          );
        })}
      </div>
    </div>
  );
}; 