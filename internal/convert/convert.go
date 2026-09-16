// Package convert converts a single JSON or YAML document.
package convert

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"

	"gopkg.in/yaml.v3"
)

func JSONToYAML(input string) (string, error) {
	if len(input) > 1<<20 {
		return "", errors.New("input must be at most 1 MiB")
	}
	if !json.Valid([]byte(input)) {
		return "", errors.New("invalid JSON document")
	}
	var node yaml.Node
	if err := yaml.Unmarshal([]byte(input), &node); err != nil {
		return "", err
	}
	// JSON flow containers become readable YAML block containers.
	var blockStyle func(*yaml.Node)
	blockStyle = func(n *yaml.Node) {
		if n.Kind == yaml.MappingNode || n.Kind == yaml.SequenceNode {
			n.Style = 0
		}
		for _, child := range n.Content {
			blockStyle(child)
		}
	}
	blockStyle(&node)
	var out bytes.Buffer
	encoder := yaml.NewEncoder(&out)
	encoder.SetIndent(2)
	if err := encoder.Encode(&node); err != nil {
		return "", err
	}
	if err := encoder.Close(); err != nil {
		return "", err
	}
	return out.String(), nil
}

func YAMLToJSON(input string) (string, error) {
	if len(input) > 1<<20 {
		return "", errors.New("input must be at most 1 MiB")
	}
	decoder := yaml.NewDecoder(strings.NewReader(input))
	var value any
	if err := decoder.Decode(&value); err != nil {
		return "", err
	}
	var extra any
	if err := decoder.Decode(&extra); err != io.EOF {
		if err != nil {
			return "", err
		}
		return "", errors.New("only one YAML document is supported")
	}
	value, err := jsonValue(value)
	if err != nil {
		return "", err
	}
	out, err := json.MarshalIndent(value, "", "  ")
	return string(out), err
}

// Reject non-string keys instead of silently changing their meaning in JSON.
func jsonValue(value any) (any, error) {
	switch v := value.(type) {
	case map[any]any:
		out := make(map[string]any, len(v))
		for key, child := range v {
			text, ok := key.(string)
			if !ok {
				return nil, fmt.Errorf("JSON object keys must be strings: %v", key)
			}
			normalized, err := jsonValue(child)
			if err != nil {
				return nil, err
			}
			out[text] = normalized
		}
		return out, nil
	case map[string]any:
		for key, child := range v {
			normalized, err := jsonValue(child)
			if err != nil {
				return nil, err
			}
			v[key] = normalized
		}
	case []any:
		for i, child := range v {
			normalized, err := jsonValue(child)
			if err != nil {
				return nil, err
			}
			v[i] = normalized
		}
	}
	return value, nil
}
