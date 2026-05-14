## Poultry Salmonella Sampling Datasets

### establishments.csv

Poultry processing plants that have had at least one poultry sample since June 28, 2020.

[Source data](https://www.fsis.usda.gov/inspection/establishments/meat-poultry-and-egg-product-inspection-directory) | [Documentation (PDF)](https://www.fsis.usda.gov/sites/default/files/media_file/2020-08/Data-Documentation-Establishment-Profile-Data.pdf)

**Calculated fields**

-  `poultry_establishment_id`: "p code" extracted from `full_establishment_id` field; used as join field to sample dataset.
- `active`: True or false based on whether this plant had any samples in the most recent 52-week sampling period.

### samples.csv
Results of routine samples taken at plants within one of the federal poultry inspection programs (Facilities with high salmonella rates may be subject to followup sampling as well; these samples are published but not included here). Includes samples back to June 28, 2020.

[Source data](https://www.fsis.usda.gov/science-data/data-sets-visualizations/laboratory-sampling-data) | [Documentation (PDF)](https://www.fsis.usda.gov/sites/default/files/media_file/2021-04/RawChickenCarcassesSamplingData_DataDocumentation.pdf)

**Calculated fields**
- `poultry_establishment_id`: "p code" extracted from `full_establishment_id` field; used as join field to establishment dataset
- `high-risk`: True or false based on whether the serotype is on the [CDC's list of the top 30 serotypes associated with human illnesses](https://www.cdc.gov/salmonella/reportspubs/salmonella-atlas/serotype-reports.html).
