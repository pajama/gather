"""Unit tests for the parts of swift_model.py that don't need a binary: python3 -m unittest -v"""
import unittest

from swift_model import demangle_type, imported_type


class DemangleTypeTest(unittest.TestCase):
    def test_standard_types_and_optionals(self):
        self.assertEqual(demangle_type('SS'), 'String')
        self.assertEqual(demangle_type('SiSg'), 'Int?')
        self.assertEqual(demangle_type('10Foundation4DateV'), 'Date')
        self.assertEqual(demangle_type('10Foundation4UUIDVSg'), 'UUID?')

    def test_generic_collections_nest(self):
        self.assertEqual(demangle_type('SaySSG'), '[String]')
        self.assertEqual(demangle_type('SDySSSiG'), '[String: Int]')
        self.assertEqual(demangle_type('SDySSSiSgG'), '[String: Int?]')
        self.assertEqual(demangle_type('SaySDySSSaySiGGG'), '[[String: [Int]]]')
        self.assertEqual(demangle_type('ShySSG'), 'Set<String>')
        self.assertEqual(demangle_type('Say«Recipe»GSg'), '[Recipe]?')
        self.assertEqual(demangle_type('SDySS«Recipe»G'), '[String: Recipe]')

    def test_nominal_types(self):
        self.assertEqual(demangle_type('So7CGFloata'), 'CGFloat')
        self.assertEqual(demangle_type('7SwiftUI5ColorV'), 'Color')
        self.assertEqual(demangle_type('«Recipe»'), 'Recipe')

    def test_objc_and_nested_types(self):
        self.assertEqual(demangle_type('So16AVCaptureSessionCSg'), 'AVCaptureSession?')
        self.assertEqual(demangle_type('So8NSStringC'), 'NSString')
        self.assertEqual(demangle_type('5Salty6RecipeV10IngredientV'), 'Recipe.Ingredient')

    def test_unknown_manglings_come_back_raw(self):
        self.assertEqual(demangle_type('BD'), 'BD')
        self.assertEqual(demangle_type('yyYbScMYccSg'), 'yyYbScMYcc?')
        self.assertEqual(demangle_type(''), '?')

    def test_imported_type(self):
        self.assertEqual(imported_type('_$s10Foundation4DateVMn'), 'Date')


if __name__ == '__main__':
    unittest.main()
