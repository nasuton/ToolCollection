// Package regex tests patterns using Go's RE2-compatible regexp engine.
package regex

import (
	"errors"
	"regexp"
	"strings"
)

type Options struct {
	Pattern string
	Text    string
	Flags   string
}

type Group struct {
	Name  string `json:"name"`
	Text  string `json:"text"`
	Start int    `json:"start"`
	End   int    `json:"end"`
}

type Match struct {
	Text   string  `json:"text"`
	Start  int     `json:"start"`
	End    int     `json:"end"`
	Groups []Group `json:"groups"`
}

type Result struct {
	Matches   []Match `json:"matches"`
	Truncated bool    `json:"truncated"`
}

// Test reports UTF-8 byte offsets; unmatched optional groups use -1.
func Test(o Options) (Result, error) {
	result := Result{Matches: []Match{}}
	if len(o.Text) > 1<<20 || len(o.Pattern) > 16<<10 {
		return result, errors.New("text must be at most 1 MiB and pattern at most 16 KiB")
	}
	for _, flag := range o.Flags {
		if !strings.ContainsRune("ims", flag) {
			return result, errors.New("supported flags are i, m and s")
		}
	}
	pattern := o.Pattern
	if o.Flags != "" {
		pattern = "(?" + o.Flags + ")" + pattern
	}
	re, err := regexp.Compile(pattern)
	if err != nil {
		return result, err
	}
	indices := re.FindAllStringSubmatchIndex(o.Text, 1001)
	if len(indices) > 1000 {
		result.Truncated = true
		indices = indices[:1000]
	}
	names := re.SubexpNames()
	for _, positions := range indices {
		match := Match{Text: o.Text[positions[0]:positions[1]], Start: positions[0], End: positions[1], Groups: []Group{}}
		for i := 2; i < len(positions); i += 2 {
			group := Group{Name: names[i/2], Start: positions[i], End: positions[i+1]}
			if group.Start >= 0 {
				group.Text = o.Text[group.Start:group.End]
			}
			match.Groups = append(match.Groups, group)
		}
		result.Matches = append(result.Matches, match)
	}
	return result, nil
}
