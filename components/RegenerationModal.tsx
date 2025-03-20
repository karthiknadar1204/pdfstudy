import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { X, Plus } from "lucide-react";

interface RegenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (options: {
    focusChapters: string[];
    focusTopics: string[];
    customInstructions: string;
  }) => void;
}

export function RegenerationModal({ isOpen, onClose, onSubmit }: RegenerationModalProps) {
  const [focusChapters, setFocusChapters] = useState<string[]>([""]);
  const [focusTopics, setFocusTopics] = useState<string[]>([""]);
  const [customInstructions, setCustomInstructions] = useState("");

  const handleAddChapter = () => {
    setFocusChapters([...focusChapters, ""]);
  };

  const handleRemoveChapter = (index: number) => {
    const newChapters = [...focusChapters];
    newChapters.splice(index, 1);
    setFocusChapters(newChapters.length ? newChapters : [""]);
  };

  const handleChapterChange = (index: number, value: string) => {
    const newChapters = [...focusChapters];
    newChapters[index] = value;
    setFocusChapters(newChapters);
  };

  const handleAddTopic = () => {
    setFocusTopics([...focusTopics, ""]);
  };

  const handleRemoveTopic = (index: number) => {
    const newTopics = [...focusTopics];
    newTopics.splice(index, 1);
    setFocusTopics(newTopics.length ? newTopics : [""]);
  };

  const handleTopicChange = (index: number, value: string) => {
    const newTopics = [...focusTopics];
    newTopics[index] = value;
    setFocusTopics(newTopics);
  };

  const handleSubmit = () => {
    // Filter out empty entries
    const filteredChapters = focusChapters.filter(chapter => chapter.trim() !== "");
    const filteredTopics = focusTopics.filter(topic => topic.trim() !== "");
    
    onSubmit({
      focusChapters: filteredChapters,
      focusTopics: filteredTopics,
      customInstructions
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Customize Summary Regeneration</DialogTitle>
          <DialogDescription>
            Focus on specific chapters or topics to customize your document summary.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="focus-chapters">Focus on Specific Chapters/Sections</Label>
            {focusChapters.map((chapter, index) => (
              <div key={`chapter-${index}`} className="flex items-center gap-2">
                <Input
                  id={`focus-chapter-${index}`}
                  value={chapter}
                  onChange={(e) => handleChapterChange(index, e.target.value)}
                  placeholder="e.g., Chapter 3, Introduction, Methodology"
                />
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => handleRemoveChapter(index)}
                  disabled={focusChapters.length === 1 && chapter === ""}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2" 
              onClick={handleAddChapter}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Chapter
            </Button>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="focus-topics">Focus on Specific Topics</Label>
            {focusTopics.map((topic, index) => (
              <div key={`topic-${index}`} className="flex items-center gap-2">
                <Input
                  id={`focus-topic-${index}`}
                  value={topic}
                  onChange={(e) => handleTopicChange(index, e.target.value)}
                  placeholder="e.g., Machine Learning, Climate Change, Financial Analysis"
                />
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => handleRemoveTopic(index)}
                  disabled={focusTopics.length === 1 && topic === ""}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2" 
              onClick={handleAddTopic}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Topic
            </Button>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="custom-instructions">Additional Instructions</Label>
            <Textarea
              id="custom-instructions"
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="Any specific instructions for the summary generation"
              rows={3}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit}>Regenerate Summaries</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 