import React from 'react';

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const TextArea: React.FC<TextAreaProps> = ({ className = '', ...props }) => {
  return (
    <textarea
      className={`w-full p-4 border-2 border-gray-200 rounded-xl text-sm font-mono
        focus:outline-none focus:border-indigo-400 focus:bg-white
        transition-all duration-200 resize-none ${className}`}
      {...props}
    />
  );
};
