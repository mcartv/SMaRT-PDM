"""
spell_check.py - Simple spell checker using system dictionary
No external packages required!
"""

import os
import re
from collections import Counter

class SimpleSpellChecker:
    def __init__(self):
        self.word_list = set()
        self.word_freq = Counter()
        self._load_dictionary()
        self._setup_ocr_corrections()
    
    def _load_dictionary(self):
        """Load words from system dictionary"""
        dict_paths = [
            "/usr/share/dict/american-english",
            "/usr/share/dict/words",
            "/usr/share/dict/british-english"
        ]
        
        loaded = False
        for path in dict_paths:
            if os.path.exists(path):
                try:
                    with open(path, 'r') as f:
                        for line in f:
                            word = line.strip().lower()
                            if word and word.isalpha():
                                self.word_list.add(word)
                                # Simple frequency based on word length
                                self.word_freq[word] = 1000 - len(word)
                    print(f"✅ Loaded {len(self.word_list)} words from {path}")
                    loaded = True
                    break
                except:
                    continue
        
        if not loaded:
            print("⚠️ No dictionary found, using basic word list")
            self._load_basic_words()
    
    def _load_basic_words(self):
        """Fallback basic English words"""
        common_words = """
        the be to of and a in that have i it for not on with he as you do at
        this but his by from they we say her she or an will my one all would
        there their what so up out if about who get which go me when make can
        like time no just him know take people into year your good some could
        them see other than then now look only come its over think also back
        after use two how our work first well way even new want because any
        these give day most us is was are been has had were said do does did
        document scan text image capture ocr scanner photo picture
        """.split()
        
        for word in common_words:
            self.word_list.add(word.lower())
            self.word_freq[word.lower()] = 100
        
        print(f"✅ Loaded {len(self.word_list)} basic words")
    
    def _setup_ocr_corrections(self):
        """Common OCR error patterns"""
        self.ocr_patterns = [
            # Common OCR mistakes
            (r'\bthc\b', 'the'),
            (r'\barid\b', 'and'),
            (r'\bfrotn\b', 'from'),
            (r'\bwitli\b', 'with'),
            (r'\bwhicli\b', 'which'),
            (r'\btliat\b', 'that'),
            (r'\bwliat\b', 'what'),
            (r'\btliis\b', 'this'),
            (r'\btlien\b', 'then'),
            (r'\btlley\b', 'they'),
            (r'\bwlicn\b', 'when'),
            (r'\bwlicre\b', 'where'),
            (r'\btlierc\b', 'there'),
            (r'\btlicir\b', 'their'),
            (r'\bhavc\b', 'have'),
            (r'\bwerc\b', 'were'),
            (r'\bwa5\b', 'was'),
            (r'\bnurnber\b', 'number'),
            (r'\bdatc\b', 'date'),
            (r'\bnarne\b', 'name'),
            (r'\baddrcss\b', 'address'),
            (r'\bphonc\b', 'phone'),
            (r'\bcornpany\b', 'company'),
            (r'\btotal\b', 'total'),
            (r'\barnount\b', 'amount'),
            (r'\bpayrnent\b', 'payment'),
            (r'\binvoicc\b', 'invoice'),
            (r'\brcceipt\b', 'receipt'),
            
            # Character confusions
            (r'(\w)cl(\w)', r'\1d\2'),  # "cl" often misread as "d"
            (r'(\w)rn(\w)', r'\1m\2'),  # "rn" often misread as "m"
        ]
        
        # Words to never change
        self.whitelist = {
            'OCR', 'PDF', 'URL', 'HTTP', 'HTTPS', 'WWW',
            'API', 'JSON', 'XML', 'HTML', 'CSS', 'JS',
            'ID', 'PIN', 'VAT', 'IBAN', 'SWIFT'
        }
    
    def known_word(self, word):
        """Check if word is in dictionary"""
        return word.lower() in self.word_list or word in self.whitelist
    
    def edits1(self, word):
        """All edits that are one edit away from word"""
        letters = 'abcdefghijklmnopqrstuvwxyz'
        splits = [(word[:i], word[i:]) for i in range(len(word) + 1)]
        
        deletes = [L + R[1:] for L, R in splits if R]
        transposes = [L + R[1] + R[0] + R[2:] for L, R in splits if len(R) > 1]
        replaces = [L + c + R[1:] for L, R in splits if R for c in letters]
        inserts = [L + c + R for L, R in splits for c in letters]
        
        return set(deletes + transposes + replaces + inserts)
    
    def edits2(self, word):
        """All edits that are two edits away"""
        return set(e2 for e1 in self.edits1(word) for e2 in self.edits1(e1))
    
    def correct_word(self, word, max_distance=2):
        """Correct a single word"""
        # Skip short words, numbers, whitelist
        if len(word) <= 2 or word.isdigit() or word in self.whitelist:
            return word
        
        # If word is already known, return it
        if self.known_word(word):
            return word
        
        # Get candidates
        candidates = set()
        
        if max_distance >= 1:
            candidates.update(self.edits1(word))
        if max_distance >= 2:
            candidates.update(self.edits2(word))
        
        # Filter to known words
        known_candidates = [w for w in candidates if self.known_word(w)]
        
        if known_candidates:
            # Return the most common candidate
            return max(known_candidates, key=lambda w: self.word_freq.get(w.lower(), 0))
        
        return word
    
    def fix_ocr_errors(self, text):
        """Apply common OCR error fixes"""
        fixed = text
        
        for pattern, replacement in self.ocr_patterns:
            fixed = re.sub(pattern, replacement, fixed, flags=re.IGNORECASE)
        
        return fixed
    
    def correct_text(self, text, aggressive=False):
        """Correct spelling in text"""
        if not text:
            return text
        
        # First apply OCR-specific fixes
        text = self.fix_ocr_errors(text)
        
        # Split into words
        words = re.findall(r'\b\w+\b', text)
        
        corrected = text
        changes = 0
        
        for word in words:
            # Skip words with numbers
            if re.search(r'\d', word):
                continue
            
            # Skip capitalized words (proper nouns) unless aggressive
            if word[0].isupper() and not aggressive and len(word) > 3:
                continue
            
            corrected_word = self.correct_word(word)
            if corrected_word != word:
                # Replace whole word only
                corrected = re.sub(rf'\b{word}\b', corrected_word, corrected)
                changes += 1
        
        if changes > 0:
            print(f"   ✅ Corrected {changes} word(s)")
        else:
            print(f"   ✅ No corrections needed")
        
        return corrected


# Global instance
spell_checker = SimpleSpellChecker()

def correct_ocr_text(text, aggressive=False):
    """Main function to correct OCR text"""
    if not text:
        return text
    
    print("\n🔍 Applying spell check...")
    corrected = spell_checker.correct_text(text, aggressive=aggressive)
    
    return corrected


# Test
if __name__ == "__main__":
    test_text = """Thc quick brown fox jurnps over thc lazy dog.
    Tliis is a test of thc OCR spell checkcr.
    We will corrcct common rnistakes arid errors.
    Thc total arnount is $50.00 on this rcceipt."""
    
    print("Original:")
    print(test_text)
    print("\n" + "=" * 50)
    
    corrected = correct_ocr_text(test_text, aggressive=True)
    
    print("\nCorrected:")
    print(corrected)