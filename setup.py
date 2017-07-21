from setuptools import setup, find_packages
from pip.req import parse_requirements
import os

requirements = parse_requirements("requirements.txt", session="")

here = os.path.abspath(os.path.dirname(__file__))
with open(os.path.join(here, 'README.md')) as f:
	long_description = f.read()

setup(
	name='glassbox',
	version='0.0.1',
	description='Project Glass Box',
	long_description=long_description,
	packages=find_packages(),
	include_package_data=True,
	install_requires=[str(ir.req) for ir in requirements],
	dependency_links=[str(ir._link) for ir in requirements if ir._link]
)
