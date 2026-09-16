package convert

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"
)

func TestRoundTrip(t *testing.T) {
	for _, input := range []string{
		`{"name":"日本語","list":[true,false,null,1.5],"nested":{"a":"yes","b":"2026-01-01"},"large":9007199254740993}`,
		`[1,"x",null]`, `"on"`, `false`, `null`, `{}`, `[]`, `18446744073709551615`,
	} {
		yaml, err := JSONToYAML(input)
		if err != nil {
			t.Fatalf("%s: %v", input, err)
		}
		output, err := YAMLToJSON(yaml)
		if err != nil {
			t.Fatalf("%s: %v", yaml, err)
		}
		decode := func(s string) any {
			d := json.NewDecoder(strings.NewReader(s))
			d.UseNumber()
			var v any
			if err := d.Decode(&v); err != nil {
				t.Fatal(err)
			}
			return v
		}
		if !reflect.DeepEqual(decode(input), decode(output)) {
			t.Errorf("%s became %s", input, output)
		}
	}
}

func TestYAMLAliases(t *testing.T) {
	output, err := YAMLToJSON("a: &value [1, 2]\nb: *value\n")
	if err != nil || !strings.Contains(output, `"b": [`) {
		t.Fatalf("alias: %s, %v", output, err)
	}
}

func TestRejectsInvalidDocuments(t *testing.T) {
	for _, input := range []string{"", "{", "{} {}", "{\"x\":NaN}", strings.Repeat(" ", 1<<20+1)} {
		if _, err := JSONToYAML(input); err == nil {
			t.Errorf("accepted invalid JSON")
		}
	}
	for _, input := range []string{"", "a: [", "a: 1\na: 2", "a: 1\n---\nb: 2", "1: value", "a: .nan", "a: .inf", "a: &a [*a]", strings.Repeat(" ", 1<<20+1)} {
		if _, err := YAMLToJSON(input); err == nil {
			t.Errorf("accepted invalid YAML: %.60s", input)
		}
	}
}
