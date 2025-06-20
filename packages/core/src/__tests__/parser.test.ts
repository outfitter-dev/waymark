// :M: tldr Tests for waymark parser functionality
import { describe, it, expect } from 'vitest';
import { WaymarkParser } from '../parser/waymark-parser.js';

describe('WaymarkParser', () => {
  it('should parse basic anchor with single context', () => {
    const content = '// :M: todo implement validation';
    const result = WaymarkParser.parseWithResult(content);
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.anchors).toHaveLength(1);
      expect(result.data.errors).toHaveLength(0);
      
      const anchor = result.data.anchors[0];
      expect(anchor).toBeDefined();
      expect(anchor!.contexts).toEqual(['todo']);
      expect(anchor!.prose).toBe('implement validation');
      expect(anchor!.line).toBe(1);
    }
  });
  
  it('should parse anchor with multiple contexts', () => {
    const content = '// :M: sec, todo validate inputs';
    const result = WaymarkParser.parseWithResult(content);
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.anchors).toHaveLength(1);
      const anchor = result.data.anchors[0];
      expect(anchor).toBeDefined();
      expect(anchor!.contexts).toEqual(['sec', 'todo']);
      expect(anchor!.prose).toBe('validate inputs');
    }
  });
  
  it('should parse anchor without prose', () => {
    const content = '// :M: tldr';
    const result = WaymarkParser.parseWithResult(content);
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.anchors).toHaveLength(1);
      const anchor = result.data.anchors[0];
      expect(anchor).toBeDefined();
      expect(anchor!.contexts).toEqual(['tldr']);
      expect(anchor!.prose).toBeUndefined();
    }
  });
  
  it('should detect missing space after :M:', () => {
    const content = '// :M:todo fix this';
    const result = WaymarkParser.parseWithResult(content);
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.anchors).toHaveLength(0);
      expect(result.data.errors).toHaveLength(1);
      expect(result.data.errors[0]?.message).toBe('Missing required space after :M:');
    }
  });
  
  it('should detect empty anchor payload', () => {
    const content = '// :M: ';
    const result = WaymarkParser.parseWithResult(content);
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.anchors).toHaveLength(0);
      expect(result.data.errors).toHaveLength(1);
      expect(result.data.errors[0]?.message).toBe('Empty anchor payload');
    }
  });
  
  it('should find anchors by context', () => {
    const content = `
      // :M: todo implement
      // :M: sec validate
      // :M: todo, perf optimize
    `;
    const result = WaymarkParser.parseWithResult(content);
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      const todoAnchors = WaymarkParser.findByContext(result.data.anchors, 'todo');
      expect(todoAnchors).toHaveLength(2);
    }
  });

  it('should handle file size limit', () => {
    // 11MB - exceeds the 10MB limit
    const largeContent = 'x'.repeat(10 * 1024 * 1024 + 1);
    const result = WaymarkParser.parseWithResult(largeContent);
    
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('file.tooLarge');
    }
  });

  it('should handle parentheses in contexts correctly', () => {
    const content = '// :M: issue(123), owner(@alice) fix authentication';
    const result = WaymarkParser.parseWithResult(content);
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.anchors).toHaveLength(1);
      const anchor = result.data.anchors[0];
      expect(anchor!.contexts).toEqual(['issue(123)', 'owner(@alice)']);
      expect(anchor!.prose).toBe('fix authentication');
    }
  });

  it('should handle complex nested parentheses and brackets in contexts', () => {
    const content = '// :M: todo(priority:high,tags:[ui,backend]), blocked:[4,7], owner:@alice test complex parsing';
    const result = WaymarkParser.parseWithResult(content);
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.anchors).toHaveLength(1);
      const anchor = result.data.anchors[0];
      expect(anchor!.contexts).toEqual(['todo(priority:high,tags:[ui,backend])', 'blocked:[4,7]', 'owner:@alice']);
      expect(anchor!.prose).toBe('test complex parsing');
    }
  });

  it('should validate contexts with colons and array syntax', () => {
    const testCases = [
      { content: '// :M: priority:high', expectedContexts: ['priority:high'] },
      { content: '// :M: owner:@alice', expectedContexts: ['owner:@alice'] },
      { content: '// :M: blocked:[123,456]', expectedContexts: ['blocked:[123,456]'] },
      { content: '// :M: tags:[ui,backend,api]', expectedContexts: ['tags:[ui,backend,api]'] },
      { content: '// :M: status:in-progress', expectedContexts: ['status:in-progress'] },
    ];

    testCases.forEach(({ content, expectedContexts }) => {
      const result = WaymarkParser.parseWithResult(content);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.anchors).toHaveLength(1);
        expect(result.data.anchors[0]!.contexts).toEqual(expectedContexts);
      }
    });
  });
});